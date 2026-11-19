import express from 'express';
import type { PrismaClient, VortexFileKind } from '@prisma/client';
import sharp from 'sharp';
import { fromBufferPromise } from 'yauzl';
import { transaction } from '../../db/transaction';
import { z, identifier } from '../../http/validation';
import { WorkflowError } from '../../workflows/errors';
import { marketplaceHandler } from './http';

const maxBytes = 2 * 1024 * 1024;
const maxFiles = 30;
const photoFormats = new Map([['image/jpeg', 'jpeg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const extensions = new Map([
  ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'],
  ['pdf', 'application/pdf'], ['csv', 'text/csv'], ['xlsx', xlsx]
]);
const metadata = { id: true, name: true, mime: true, kind: true, size: true, createdAt: true } as const;

async function workbookPreview(content: Buffer) {
  const zip = await fromBufferPromise(content, { strictFileNames: true });
  try {
    if (zip.entryCount > 1000) throw new Error('Workbook contains too many entries');
    const names = new Set<string>();
    let sheet = '', strings = '';
    for await (const entry of zip.eachEntry()) {
      if (names.has(entry.fileName)) throw new Error('Duplicate workbook entries');
      names.add(entry.fileName);
      const worksheet = !sheet && /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.fileName);
      if (!worksheet && entry.fileName !== 'xl/sharedStrings.xml') continue;
      if (entry.uncompressedSize > maxBytes) throw new Error('Worksheet exceeds preview size');
      const stream = await zip.openReadStreamPromise(entry);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      const xml = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
      if (/<!DOCTYPE/i.test(xml)) throw new Error('Workbook declarations are not supported');
      if (worksheet) sheet = xml;
      else strings = xml;
    }
    if (!sheet || !names.has('[Content_Types].xml') || !names.has('xl/workbook.xml')) throw new Error('Missing workbook entries');
    return { sheet, strings };
  } finally { zip.close(); }
}

async function inspectFile(content: Buffer, mime: string): Promise<{ content: Buffer; mime: string; kind: VortexFileKind }> {
  const format = photoFormats.get(mime);
  if (format) {
    try {
      const image = sharp(content, { limitInputPixels: 16_000_000, animated: false });
      if ((await image.metadata()).format !== format) throw new Error('Format mismatch');
      const photo = await image.rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true }).webp().toBuffer();
      return { content: photo, mime: 'image/webp', kind: 'PHOTO' };
    } catch {
      throw new WorkflowError(415, 'The file is not a supported image or is larger than 16 megapixels');
    }
  }
  if (mime === 'application/pdf' && /^%PDF-[12]\.\d/.test(content.subarray(0, 8).toString('ascii')) && content.subarray(-1024).includes('%%EOF')) {
    return { content, mime, kind: 'PDF' };
  }
  if (mime === 'text/csv') {
    try {
      const csv = new TextDecoder('utf-8', { fatal: true }).decode(content);
      if (csv.trim() && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(csv)) return { content, mime, kind: 'SPREADSHEET' };
    } catch { /* Reject non-UTF-8 data. */ }
  }
  if (mime === xlsx) {
    try {
      await workbookPreview(content);
      return { content, mime, kind: 'SPREADSHEET' };
    } catch { throw new WorkflowError(415, 'Invalid Excel workbook or worksheet exceeds the preview limit'); }
  }
  throw new WorkflowError(415, 'File content does not match a supported type');
}

export function marketplaceFiles(db: PrismaClient) {
  const router = express.Router();
  router.get('/', marketplaceHandler(async (_req, res) => {
    const items = await db.vortexFile.findMany({ where: { sellerId: res.locals.user.id }, select: metadata, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
    const counts = { PHOTO: 0, PDF: 0, SPREADSHEET: 0 };
    for (const item of items) counts[item.kind]++;
    res.json({ items, counts, maxBytes, maxFiles });
  }));
  // The client sends one raw file per request so the same limit applies to each
  // file and one rejected upload does not discard the rest of a batch.
  router.post('/', express.raw({ type: 'application/octet-stream', limit: maxBytes, inflate: false }), marketplaceHandler(async (req, res) => {
    const { name } = z.object({ name: z.string().trim().min(1).max(160).regex(/^[^/\\\u0000-\u001f\u007f]+$/) }).parse(req.query);
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new WorkflowError(415, 'Select a non-empty file');
    const mime = extensions.get(name.split('.').pop()?.toLowerCase() ?? '');
    if (!mime || !name.includes('.')) throw new WorkflowError(415, 'Choose a PNG, JPEG, WebP, PDF, CSV or XLSX file');
    const file = await inspectFile(req.body, mime);
    if (file.content.length > maxBytes) throw new WorkflowError(413, 'The processed photo exceeds the 2 MB limit');
    const sellerId: string = res.locals.user.id;
    const result = await transaction(db, async tx => {
      await tx.$queryRaw`SELECT id FROM orvilo."User" WHERE id = ${sellerId} FOR UPDATE`;
      if (await tx.vortexFile.count({ where: { sellerId } }) >= maxFiles) throw new WorkflowError(409, 'Your library holds up to 30 files');
      return tx.vortexFile.create({
        data: { ...file, sellerId, name, size: file.content.length, content: new Uint8Array(file.content) },
        select: metadata
      });
    });
    res.status(201).json(result);
  }));
  router.get('/:id/content', marketplaceHandler(async (req, res) => {
    const id = identifier.parse(req.params.id);
    const file = await db.vortexFile.findFirst({ where: { id, sellerId: res.locals.user.id } });
    if (!file) throw new WorkflowError(404, 'File not found');
    const name = file.kind === 'PHOTO' ? file.name.replace(/\.[^.]+$/, '.webp') : file.name;
    res.attachment(name).type(file.mime).send(Buffer.from(file.content));
  }));
  router.get('/:id/workbook-preview', marketplaceHandler(async (req, res) => {
    const id = identifier.parse(req.params.id);
    const file = await db.vortexFile.findFirst({ where: { id, sellerId: res.locals.user.id, mime: xlsx } });
    if (!file) throw new WorkflowError(404, 'Workbook not found');
    res.json(await workbookPreview(Buffer.from(file.content)));
  }));
  router.delete('/:id', marketplaceHandler(async (req, res) => {
    const id = identifier.parse(req.params.id);
    const result = await db.vortexFile.deleteMany({ where: { id, sellerId: res.locals.user.id } });
    if (!result.count) throw new WorkflowError(404, 'File not found');
    res.status(204).end();
  }));
  return router;
}
