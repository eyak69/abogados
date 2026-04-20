import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from 'docx';

/**
 * Servicio Senior de Exportación: Genera documentos PDF y Word 
 * con diseño institucional de alta fidelidad.
 * SE REFACTORIZA A PDFKIT PARA MAYOR ESTABILIDAD DE FUENTES EN NODE.
 */
export class ExportService {

    /**
     * Genera un Buffer de PDF desde el contenido en Markdown usando PDFKit directamente
     */
    static async generatePDF(content: string, title = "Informe Legal"): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50, size: 'A4' });
                const chunks: any[] = [];

                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));

                // --- ENCABEZADO PREMIUM ---
                doc.fontSize(10).fillColor('#7f8c8d').text('DIVISIÓN DE ASISTENCIA JURÍDICA IA', { align: 'right' });
                doc.moveDown(1);
                
                doc.fontSize(18).fillColor('#2c3e50').font('Helvetica-Bold').text(title.toUpperCase());
                doc.fontSize(9).fillColor('#95a5a6').font('Helvetica').text(`Fecha de emisión: ${new Date().toLocaleString('es-AR')}`);
                
                doc.moveDown(0.5);
                doc.strokeColor('#2c3e50').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(1.5);

                // --- CONTENIDO ---
                const lines = content.split('\n');
                doc.fillColor('#2c3e50').fontSize(11).font('Helvetica');

                lines.forEach(line => {
                    if (line.trim() === '') {
                        doc.moveDown(0.5);
                        return;
                    }

                    // Títulos (Negritas simples)
                    if (line.startsWith('**') && line.endsWith('**')) {
                        doc.font('Helvetica-Bold').fontSize(12).text(line.replace(/\*\*/g, ''));
                        doc.moveDown(0.5);
                        return;
                    }

                    // Listas
                    if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                        doc.font('Helvetica').fontSize(11).text(`  •  ${line.trim().replace(/^[\*\-]\s*/, '')}`, {
                            indent: 10,
                            align: 'justify'
                        });
                        return;
                    }

                    // Párrafo normal con soporte básico de negritas internas
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    doc.font('Helvetica').fontSize(11);
                    
                    parts.forEach(part => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            doc.font('Helvetica-Bold').text(part.replace(/\*\*/g, ''), { continued: true });
                        } else {
                            doc.font('Helvetica').text(part, { continued: true });
                        }
                    });
                    
                    // Finalizar línea (continuación desactivada)
                    doc.text('', { continued: false });
                    doc.moveDown(0.5);
                });

                // --- PIE DE PÁGINA ---
                const range = doc.bufferedPageRange();
                for (let i = range.start; i < range.start + range.count; i++) {
                    doc.switchToPage(i);
                    doc.fontSize(8).fillColor('#bdc3c7').text(
                        `Generado por Plataforma Abogados Premium - Página ${i + 1}`,
                        50,
                        doc.page.height - 50,
                        { align: 'center' }
                    );
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Genera un Buffer de Word (.docx)
     */
    static async generateWord(content: string, title = "Informe Legal"): Promise<Buffer> {
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: "DIVISIÓN DE ASISTENCIA JURÍDICA IA",
                        alignment: AlignmentType.RIGHT,
                        heading: HeadingLevel.HEADING_6
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({ text: title, bold: true, size: 32, color: "2c3e50" }),
                        ],
                        spacing: { after: 400 }
                    }),
                    new Paragraph({
                        text: `Fecha: ${new Date().toLocaleString('es-AR')}`,
                        spacing: { after: 800 }
                    }),
                    ...this.parseMarkdownToDocx(content)
                ],
            }],
        });

        return await Packer.toBuffer(doc);
    }

    /**
     * Parser simplificado de Markdown para DOCX
     */
    private static parseMarkdownToDocx(text: string): Paragraph[] {
        const lines = text.split('\n');
        return lines.map(line => {
            const isBullet = line.trim().startsWith('*') || line.trim().startsWith('-');
            const cleanLine = line.replace(/^\s*[\*\-]\s*/, '').replace(/\*\*/g, '');
            
            return new Paragraph({
                text: cleanLine,
                bullet: isBullet ? { level: 0 } : undefined,
                spacing: { before: 100, after: 100 }
            });
        });
    }
}
