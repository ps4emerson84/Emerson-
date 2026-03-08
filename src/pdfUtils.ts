import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventorySession } from './types';

export const generateInventoryPDF = (session: InventorySession) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(37, 99, 235); // Blue 600
  doc.text('Relatório de Inventário', 14, 22);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`SuperStock - Sistema de Gestão`, 14, 28);

  // Session Info
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Nome: ${session.name}`, 14, 40);
  doc.text(`Setor: ${session.sector}`, 14, 47);
  doc.text(`Data: ${new Date(session.startTime).toLocaleDateString('pt-BR')}`, 14, 54);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 61);

  // Table
  const tableData = session.items.map(item => [
    item.productCode,
    item.productDescription,
    item.type === 'weight' ? 'Peso' : 'Unidade',
    item.type === 'weight' ? `${item.quantity.toFixed(3)} kg` : item.quantity.toString(),
    item.tareWeight ? `${item.tareWeight.toFixed(3)} kg` : '-'
  ]);

  autoTable(doc, {
    startY: 70,
    head: [['Código', 'Descrição', 'Tipo', 'Qtd/Peso', 'Tara']],
    body: tableData,
    headStyles: { fillColor: [37, 99, 235] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  // Footer / Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalWeight = session.items
    .filter(i => i.type === 'weight')
    .reduce((acc, curr) => acc + curr.quantity, 0);
  const totalUnits = session.items
    .filter(i => i.type === 'unit')
    .reduce((acc, curr) => acc + curr.quantity, 0);
  const totalProducts = session.items.length;

  doc.setFontSize(12);
  doc.text(`Total de Itens: ${totalProducts}`, 14, finalY);
  doc.text(`Total em Unidades: ${totalUnits}`, 14, finalY + 7);
  doc.text(`Total em Peso: ${totalWeight.toFixed(3)} kg`, 14, finalY + 14);

  // Save
  doc.save(`inventario_${session.name.replace(/\s+/g, '_').toLowerCase()}.pdf`);
};
