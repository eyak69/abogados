const pdf = require('pdf-parse');
console.log('--- DIAGNOSTICO PDF-PARSE ---');
console.log('Type of pdf:', typeof pdf);
console.log('Object keys:', Object.keys(pdf));
if (typeof pdf === 'function') {
    console.log('PDF is a function');
} else if (pdf.default) {
    console.log('PDF has a default property, type:', typeof pdf.default);
} else {
    console.log('PDF is something else:', pdf);
}
