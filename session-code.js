export const SESSION_CODE_PATTERN = '[A-Z0-9]{3,12}';
const validCode = new RegExp(`^${SESSION_CODE_PATTERN}$`);

export function normalizeSessionCode(value) {
 return String(value ?? '').replace(/[\s-]/g, '').toUpperCase();
}

export function isValidSessionCode(code) {
 return typeof code === 'string' && validCode.test(code);
}

export function requireSessionCode(value) {
 const code = normalizeSessionCode(value);
 if (!isValidSessionCode(code)) {
  throw Object.assign(new Error('Enter a session code with 3 to 12 letters or numbers.'), {code: 'invalid-session-code'});
 }
 return code;
}

export function sessionCodeTaken(code) {
 return Object.assign(new Error(`Session code ${code} is already in use. Choose another code.`), {code: 'session-code-taken'});
}
