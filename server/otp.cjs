// Keep native import in a JavaScript CommonJS module: TypeScript's CommonJS
// transform would turn import() back into require(), breaking ESM-only plugins.
let otp;
module.exports.loadOtp = () => otp ||= import('otplib');
