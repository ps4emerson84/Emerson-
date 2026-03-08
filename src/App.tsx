/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Scale, 
  Hash, 
  FileText, 
  ArrowLeft, 
  Trash2, 
  Edit2,
  Save, 
  Camera, 
  ChevronRight,
  Package,
  History,
  CheckCircle2,
  X,
  Share2,
  Upload,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { Product, Tare, InventorySession, InventoryItem, SECTORS, RecordType } from './types';
import { db } from './db';
import { generateInventoryPDF } from './pdfUtils';

type View = 'dashboard' | 'new-session' | 'active-session' | 'products' | 'taras';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taras, setTaras] = useState<Tare[]>([]);
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  
  // Form States
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionSector, setNewSessionSector] = useState(SECTORS[0]);
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editingSession, setEditingSession] = useState<InventorySession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form States (Search & Selection)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recordType, setRecordType] = useState<RecordType>('unit');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  // Product Form States
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductDesc, setNewProductDesc] = useState('');

  // Weight Form States
  const [grossWeight, setGrossWeight] = useState('');
  const [selectedTaras, setSelectedTaras] = useState<{ [id: string]: number }>({});
  const [isAddingTare, setIsAddingTare] = useState(false);
  const [editingTareId, setEditingTareId] = useState<string | null>(null);
  const [newTareName, setNewTareName] = useState('');
  const [newTareWeight, setNewTareWeight] = useState('');
  const [newTareImage, setNewTareImage] = useState<string | undefined>(undefined);
  
  // Unit Form States
  const [unitCount, setUnitCount] = useState('');

  useEffect(() => {
    setSessions(db.getSessions());
    setProducts(db.getProducts());
    setTaras(db.getTaras());
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        const importedProducts: Product[] = json.map((item) => {
          // Normalizar chaves para busca (remover acentos e converter para minúsculo)
          const keys = Object.keys(item);
          
          const findKey = (searchTerms: string[]) => {
            return keys.find(k => {
              const normalizedKey = k.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
              return searchTerms.some(term => normalizedKey.includes(term));
            });
          };

          const codeKey = findKey(['codigo', 'code', 'cod']);
          const descKey = findKey(['descricao', 'description', 'desc', 'produto', 'item']);

          return {
            id: crypto.randomUUID(),
            code: codeKey ? String(item[codeKey]).trim() : '',
            description: descKey ? String(item[descKey]).trim() : ''
          };
        }).filter(p => p.code && p.description);

        if (importedProducts.length > 0) {
          db.saveProducts(importedProducts);
          setProducts(db.getProducts());
          alert(`${importedProducts.length} produtos importados com sucesso!`);
        } else {
          alert("Nenhum produto válido encontrado. Verifique se a planilha tem as colunas 'codigo' e 'descricao'.");
        }
      } catch (error) {
        console.error("Erro ao ler arquivo:", error);
        alert("Erro ao processar a planilha. Certifique-se de que é um arquivo Excel válido.");
      }
      // Limpar o input para permitir re-upload do mesmo arquivo
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddProduct = () => {
    if (!newProductCode || !newProductDesc) return;
    const product: Product = {
      id: editingProductId || crypto.randomUUID(),
      code: newProductCode,
      description: newProductDesc
    };
    db.saveProduct(product);
    setProducts(db.getProducts());
    setIsAddingProduct(false);
    setEditingProductId(null);
    setNewProductCode('');
    setNewProductDesc('');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setNewProductCode(product.code);
    setNewProductDesc(product.description);
    setIsAddingProduct(true);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      db.deleteProduct(id);
      setProducts(db.getProducts());
    }
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      p.code.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [products, searchQuery]);

  const groupedItems = useMemo(() => {
    if (!activeSession) return [];
    
    const groups: { [key: string]: InventoryItem & { count: number; ids: string[] } } = {};
    
    activeSession.items.forEach(item => {
      const tareKey = [...(item.tareIds || [])].sort().join(',');
      const key = `${item.productId}-${item.type}-${tareKey}`;
      
      if (!groups[key]) {
        groups[key] = {
          ...item,
          count: 1,
          ids: [item.id]
        };
      } else {
        groups[key].quantity += item.quantity;
        groups[key].count += 1;
        groups[key].ids.push(item.id);
        if (item.timestamp > groups[key].timestamp) {
          groups[key].timestamp = item.timestamp;
        }
      }
    });
    
    return Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
  }, [activeSession?.items]);

  const handleNewSessionClick = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    setNewSessionName(`Inventário ${dateStr} ${timeStr}`);
    setView('new-session');
  };

  const handleStartSession = () => {
    if (!newSessionName) return;
    const session: InventorySession = {
      id: crypto.randomUUID(),
      name: newSessionName,
      sector: newSessionSector,
      startTime: Date.now(),
      items: []
    };
    db.saveSession(session);
    setSessions(db.getSessions());
    setActiveSession(session);
    setView('active-session');
    setNewSessionName('');
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir este relatório?')) {
      db.deleteSession(id);
      setSessions(db.getSessions());
    }
  };

  const handleEditSession = (e: React.MouseEvent, session: InventorySession) => {
    e.stopPropagation();
    setEditingSession(session);
    setNewSessionName(session.name);
    setNewSessionSector(session.sector);
    setIsEditingSession(true);
  };

  const handleUpdateSession = () => {
    if (!editingSession) return;
    const updated = {
      ...editingSession,
      name: newSessionName,
      sector: newSessionSector
    };
    db.saveSession(updated);
    setSessions(db.getSessions());
    setIsEditingSession(false);
    setEditingSession(null);
    setNewSessionName('');
  };

  const handleSaveItem = () => {
    if (!activeSession || !selectedProduct) return;

    let quantity = 0;
    let itemData: Partial<InventoryItem> = {};

    if (recordType === 'unit') {
      quantity = parseFloat(unitCount) || 0;
      if (quantity <= 0) return;
    } else {
      const gross = parseFloat(grossWeight) || 0;
      const totalTare = (Object.entries(selectedTaras) as [string, number][]).reduce((sum, [id, qty]) => {
        const tare = taras.find(t => t.id === id);
        return sum + (tare ? tare.weight * qty : 0);
      }, 0);
      quantity = Math.max(0, gross - totalTare);
      if (gross <= 0) return;

      const tareIds: string[] = [];
      (Object.entries(selectedTaras) as [string, number][]).forEach(([id, qty]) => {
        for (let i = 0; i < qty; i++) {
          tareIds.push(id);
        }
      });

      itemData = {
        grossWeight: gross,
        tareWeight: totalTare,
        tareIds
      };
    }

    const updatedItems = [...activeSession.items];

    if (editingItemId) {
      const index = updatedItems.findIndex(i => i.id === editingItemId);
      if (index >= 0) {
        updatedItems[index] = {
          ...updatedItems[index],
          productId: selectedProduct.id,
          productCode: selectedProduct.code,
          productDescription: selectedProduct.description,
          type: recordType,
          quantity,
          timestamp: Date.now(),
          ...itemData
        };
      }
    } else {
      const newItem: InventoryItem = {
        id: crypto.randomUUID(),
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        productDescription: selectedProduct.description,
        sector: activeSession.sector,
        type: recordType,
        quantity,
        timestamp: Date.now(),
        ...itemData
      };
      updatedItems.push(newItem);
    }

    const updatedSession = { ...activeSession, items: updatedItems };
    setActiveSession(updatedSession);
    db.saveSession(updatedSession);
    setSessions(db.getSessions());

    // Reset form
    setSelectedProduct(null);
    setSearchQuery('');
    setGrossWeight('');
    setUnitCount('');
    setSelectedTaras({});
    setEditingItemId(null);
  };

  const handleDeleteItems = (itemIds: string[]) => {
    if (!activeSession) return;
    if (confirm(`Deseja excluir ${itemIds.length > 1 ? 'estes registros agrupados' : 'este registro'}?`)) {
      const updatedItems = activeSession.items.filter(i => !itemIds.includes(i.id));
      const updatedSession = { ...activeSession, items: updatedItems };
      setActiveSession(updatedSession);
      db.saveSession(updatedSession);
      setSessions(db.getSessions());
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;

    setSelectedProduct(product);
    setRecordType(item.type);
    setEditingItemId(item.id);

    if (item.type === 'unit') {
      setUnitCount(item.quantity.toString());
    } else {
      setGrossWeight(item.grossWeight?.toString() || '');
      const tareCounts: { [id: string]: number } = {};
      item.tareIds?.forEach(id => {
        tareCounts[id] = (tareCounts[id] || 0) + 1;
      });
      setSelectedTaras(tareCounts);
    }
    
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateTare = () => {
    if (!newTareName || !newTareWeight) return;
    const tare: Tare = {
      id: editingTareId || crypto.randomUUID(),
      name: newTareName,
      weight: parseFloat(newTareWeight),
      image: newTareImage
    };
    db.saveTare(tare);
    setTaras(db.getTaras());
    if (!editingTareId) {
      setSelectedTaras(prev => ({ ...prev, [tare.id]: 1 }));
    }
    setIsAddingTare(false);
    setEditingTareId(null);
    setNewTareName('');
    setNewTareWeight('');
    setNewTareImage(undefined);
  };

  const handleEditTare = (tare: Tare) => {
    setEditingTareId(tare.id);
    setNewTareName(tare.name);
    setNewTareWeight(tare.weight.toString());
    setNewTareImage(tare.image);
    setIsAddingTare(true);
  };

  const handleDeleteTare = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta tara?')) {
      db.deleteTare(id);
      setTaras(db.getTaras());
      setSelectedTaras(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTareImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const totals = useMemo(() => {
    if (!activeSession) return { weight: 0, units: 0 };
    return activeSession.items.reduce((acc, item) => {
      if (item.type === 'weight') acc.weight += item.quantity;
      else acc.units += item.quantity;
      return acc;
    }, { weight: 0, units: 0 });
  }, [activeSession]);

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-app-bg">
      {/* Header */}
      <header className="bg-app-bg/80 backdrop-blur-md px-6 py-6 sticky top-0 z-20 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {view !== 'dashboard' && (
              <button onClick={() => setView('dashboard')} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
                <ArrowLeft size={24} />
              </button>
            )}
            <div className="flex flex-col">
              <img 
                src="https://logodownload.org/wp-content/uploads/2021/06/grupo-mateus-logo-0.png" 
                alt="Grupo Mateus" 
                className="h-8 w-auto object-contain mb-1"
                referrerPolicy="no-referrer"
              />
              <span className="status-label text-[8px] text-mix-blue">Expedição Omixx</span>
            </div>
          </div>
          {view === 'active-session' && (
            <button 
              onClick={() => activeSession && generateInventoryPDF(activeSession)}
              className="p-3 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/10"
            >
              <FileText size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-24">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleNewSessionClick}
                  className="glass-card p-8 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
                >
                  <div className="p-4 bg-primary/20 rounded-2xl text-primary group-hover:scale-110 transition-transform">
                    <Plus size={32} />
                  </div>
                  <span className="status-label">Novo</span>
                </button>
                <button 
                  onClick={() => setView('products')}
                  className="glass-card p-8 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
                >
                  <div className="p-4 bg-mix-blue/20 rounded-2xl text-mix-blue group-hover:scale-110 transition-transform">
                    <Package size={32} />
                  </div>
                  <span className="status-label">Produtos</span>
                </button>
                <button 
                  onClick={() => setView('taras')}
                  className="glass-card p-8 flex flex-col items-center gap-3 hover:bg-white/10 transition-all group"
                >
                  <div className="p-4 bg-mix-blue/20 rounded-2xl text-mix-blue group-hover:scale-110 transition-transform">
                    <Scale size={32} />
                  </div>
                  <span className="status-label">Taras</span>
                </button>
                <button 
                  className="glass-card p-8 flex flex-col items-center gap-3 opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="p-4 bg-white/10 rounded-2xl text-slate-600">
                    <History size={32} />
                  </div>
                  <span className="status-label">Histórico</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="status-label">Inventários Recentes</h2>
                  <History size={16} className="text-slate-600" />
                </div>
                
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                      <History size={48} className="mx-auto text-slate-800 mb-4 opacity-20" />
                      <p className="text-slate-500 text-sm">Nenhum histórico encontrado</p>
                    </div>
                  ) : (
                    sessions.map(session => (
                      <div 
                        key={session.id}
                        className="glass-card p-5 flex items-center justify-between group hover:border-white/20 transition-all"
                      >
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                          setActiveSession(session);
                          setView('active-session');
                        }}>
                          <h3 className="font-bold text-white mb-1 truncate">{session.name}</h3>
                          <div className="flex items-center gap-3">
                            <span className="status-label text-[9px]">{new Date(session.startTime).toLocaleDateString()}</span>
                            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                            <span className="status-label text-[9px] text-mix-blue">{session.sector}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button 
                            onClick={(e) => handleEditSession(e, session)}
                            className="p-2 text-slate-500 hover:text-mix-blue transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteSession(e, session.id)}
                            className="p-2 text-slate-500 hover:text-primary transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                          <ChevronRight size={20} className="text-slate-700 group-hover:text-white transition-colors" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'new-session' && (
            <motion.div 
              key="new-session"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="glass-card p-8 space-y-6">
                <div>
                  <label className="status-label mb-3 block ml-1">Nome do Inventário</label>
                  <input 
                    type="text"
                    placeholder="Ex: Inventário Hortifruti Noite"
                    className="input-field"
                    value={newSessionName}
                    onChange={e => setNewSessionName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="status-label mb-3 block ml-1">Setor</label>
                  <select 
                    className="input-field appearance-none"
                    value={newSessionSector}
                    onChange={e => setNewSessionSector(e.target.value)}
                  >
                    {SECTORS.map(s => <option key={s} value={s} className="bg-app-bg">{s}</option>)}
                  </select>
                </div>
                <button 
                  onClick={handleStartSession}
                  disabled={!newSessionName}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  Iniciar Inventário
                </button>
              </div>
            </motion.div>
          )}

          {view === 'active-session' && (
            <motion.div 
              key="active-session"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Product Search & Selection */}
              <div className="glass-card p-6 space-y-6">
                {!selectedProduct ? (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input 
                      type="text"
                      placeholder="Buscar por código ou descrição..."
                      className="input-field pl-12"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && filteredProducts.length > 0) {
                          setSelectedProduct(filteredProducts[0]);
                        }
                      }}
                    />
                    {filteredProducts.length > 0 && (
                      <div className="absolute top-full left-0 right-0 glass-card mt-2 z-10 overflow-hidden border-white/10">
                        {filteredProducts.map(p => (
                          <button 
                            key={p.id}
                            onClick={() => setSelectedProduct(p)}
                            className="w-full px-5 py-4 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-bold text-white">{p.description}</p>
                              <p className="status-label text-[9px]">Cód: {p.code}</p>
                            </div>
                            <Plus size={16} className="text-mix-blue" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {editingItemId && (
                      <div className="flex items-center justify-between bg-primary/10 p-3 rounded-2xl border border-primary/20">
                        <span className="status-label text-primary flex items-center gap-2">
                          <Edit2 size={12} /> Editando Registro
                        </span>
                        <button 
                          onClick={() => {
                            setEditingItemId(null);
                            setSelectedProduct(null);
                            setGrossWeight('');
                            setUnitCount('');
                            setSelectedTaras([]);
                          }}
                          className="status-label text-white underline"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{selectedProduct.description}</h3>
                        <p className="status-label text-[9px]">Cód: {selectedProduct.code}</p>
                      </div>
                      <button onClick={() => setSelectedProduct(null)} className="p-2 text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
                      <button 
                        onClick={() => setRecordType('unit')}
                        className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${recordType === 'unit' ? 'bg-primary text-white shadow-lg' : 'text-slate-500'}`}
                      >
                        Unidade
                      </button>
                      <button 
                        onClick={() => setRecordType('weight')}
                        className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${recordType === 'weight' ? 'bg-mix-blue text-white shadow-lg' : 'text-slate-500'}`}
                      >
                        Pesagem
                      </button>
                    </div>

                    {recordType === 'unit' ? (
                      <div className="space-y-4">
                        <label className="status-label block ml-1">Quantidade</label>
                        <input 
                          type="number"
                          inputMode="numeric"
                          placeholder="0"
                          className="input-field data-value"
                          value={unitCount}
                          onChange={e => setUnitCount(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveItem()}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="status-label block ml-1">Peso Bruto (kg)</label>
                          <input 
                            type="number"
                            inputMode="decimal"
                            placeholder="0.000"
                            className="input-field data-value"
                            value={grossWeight}
                            onChange={e => setGrossWeight(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSaveItem()}
                            autoFocus
                          />
                        </div>
                        
                        <div className="space-y-4">
                          <label className="status-label block ml-1">Selecionar Tara (Múltiplas)</label>
                          <div className="grid grid-cols-1 gap-3">
                            {taras.map(t => {
                              const qty = selectedTaras[t.id] || 0;
                              return (
                                <div 
                                  key={t.id}
                                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${qty > 0 ? 'border-mix-blue bg-mix-blue/20' : 'border-white/10 bg-white/5'}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white text-xs truncate">{t.name}</p>
                                    <p className="data-value text-[10px] text-mix-blue">{t.weight.toFixed(3)} kg</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-3">
                                    <button 
                                      onClick={() => {
                                        if (qty > 0) {
                                          setSelectedTaras(prev => {
                                            const next = { ...prev };
                                            if (qty === 1) {
                                              delete next[t.id];
                                            } else {
                                              next[t.id] = qty - 1;
                                            }
                                            return next;
                                          });
                                        }
                                      }}
                                      className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10"
                                    >
                                      -
                                    </button>
                                    <span className="data-value text-sm w-4 text-center text-white">{qty}</span>
                                    <button 
                                      onClick={() => {
                                        setSelectedTaras(prev => ({ ...prev, [t.id]: (prev[t.id] || 0) + 1 }));
                                      }}
                                      className="w-8 h-8 rounded-lg bg-mix-blue text-white flex items-center justify-center hover:bg-mix-blue/80"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            <button 
                              onClick={() => setIsAddingTare(true)}
                              className="p-4 rounded-2xl border border-dashed border-white/10 text-slate-500 flex flex-col items-center justify-center gap-1 hover:border-white/20 transition-all"
                            >
                              <Plus size={16} />
                              <span className="status-label text-[8px]">Nova Tara</span>
                            </button>
                          </div>
                        </div>

                        {grossWeight && (
                          <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="status-label">Total Tara:</span>
                              <span className="data-value text-sm">
                                {(Object.entries(selectedTaras) as [string, number][]).reduce((sum, [id, q]) => {
                                  const tare = taras.find(t => t.id === id);
                                  return sum + (tare ? tare.weight * q : 0);
                                }, 0).toFixed(3)} kg
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="status-label text-mix-blue">Peso Líquido:</span>
                              <span className="data-value text-2xl text-white">
                                {(Math.max(0, (parseFloat(grossWeight) || 0) - (Object.entries(selectedTaras) as [string, number][]).reduce((sum, [id, q]) => {
                                  const tare = taras.find(t => t.id === id);
                                  return sum + (tare ? tare.weight * q : 0);
                                }, 0))).toFixed(3)} kg
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={handleSaveItem}
                      className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all ${recordType === 'unit' ? 'bg-primary text-white' : 'bg-mix-blue text-white'}`}
                    >
                      {editingItemId ? 'Atualizar Registro' : 'Salvar Registro'}
                    </button>
                  </div>
                )}
              </div>

              {/* Inventory List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="status-label">Itens Registrados</h2>
                  <span className="status-label text-mix-blue">{activeSession.items.length} itens</span>
                </div>
                
                {groupedItems.length === 0 ? (
                  <div className="glass-card p-12 text-center">
                    <Package size={48} className="mx-auto text-slate-800 mb-4 opacity-20" />
                    <p className="text-slate-500 text-sm">Nenhum item registrado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedItems.map(item => (
                      <div key={item.id} className="glass-card p-5 flex items-center justify-between gap-4 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="status-label text-[8px] bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                              {item.type === 'weight' ? 'Peso' : 'Unid'}
                            </span>
                            <h4 className="font-bold text-white truncate">
                              {item.productDescription}
                              {item.count > 1 && (
                                <span className="ml-2 text-mix-blue text-[10px] bg-mix-blue/10 px-1.5 py-0.5 rounded">
                                  {item.count}x
                                </span>
                              )}
                            </h4>
                          </div>
                          <p className="status-label text-[9px]">Cód: {item.productCode} {item.tareWeight ? `• Tara: ${item.tareWeight.toFixed(3)}kg` : ''}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="data-value text-lg text-white">
                              {item.type === 'weight' ? `${item.quantity.toFixed(3)} kg` : item.quantity}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleEditItem(item)}
                              className="p-2 text-slate-500 hover:text-mix-blue transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteItems(item.ids)}
                              className="p-2 text-slate-500 hover:text-primary transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'products' && (
            <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsAddingProduct(true)}
                  className="flex-1 btn-primary"
                >
                  <Plus size={20} /> Novo
                </button>
                <label className="flex-1 btn-secondary cursor-pointer">
                  <Upload size={20} /> Importar
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <p className="status-label text-[8px] text-center">
                O Excel deve conter as colunas: <b>codigo</b> e <b>descricao</b>.
              </p>

              <div className="glass-card p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="status-label text-mix-blue">Lista de Produtos</h3>
                  <span className="status-label text-[9px]">{products.length} cadastrados</span>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {products.map(p => (
                    <div key={p.id} className="p-4 bg-white/5 rounded-2xl border border-white/10 flex justify-between items-center group hover:bg-white/10 transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white mb-1 truncate">{p.description}</p>
                        <p className="status-label text-[9px]">Cód: {p.code}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditProduct(p)}
                          className="p-2 text-slate-500 hover:text-mix-blue transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-2 text-slate-500 hover:text-primary transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'taras' && (
            <motion.div key="taras" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsAddingTare(true)}
                  className="flex-1 btn-primary"
                >
                  <Plus size={20} /> Nova Tara
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {taras.map(t => (
                  <div key={t.id} className="glass-card p-6 flex flex-col items-center text-center group hover:bg-white/10 transition-all relative">
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditTare(t)}
                        className="p-1.5 bg-white/5 rounded-lg text-slate-500 hover:text-mix-blue transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteTare(t.id)}
                        className="p-1.5 bg-white/5 rounded-lg text-slate-500 hover:text-primary transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {t.image ? (
                      <img src={t.image} alt={t.name} className="w-20 h-20 object-cover rounded-2xl mb-4 border border-white/10" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-20 h-20 bg-white/5 rounded-2xl mb-4 flex items-center justify-center text-slate-700 border border-white/10">
                        <Scale size={32} />
                      </div>
                    )}
                    <p className="font-bold text-white text-sm truncate w-full mb-1">{t.name}</p>
                    <p className="data-value text-sm text-mix-blue">{t.weight.toFixed(3)} kg</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Footer for Active Session Totals */}
      {view === 'active-session' && (
        <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-app-bg/80 backdrop-blur-xl border-t border-white/5 p-6 shadow-2xl z-30">
          <div className="flex justify-between items-center">
            <div className="flex gap-6">
              <div>
                <p className="status-label text-mix-blue mb-1">Total Peso</p>
                <p className="data-value text-white">{totals.weight.toFixed(3)} kg</p>
              </div>
              <div className="w-px h-10 bg-white/10 self-center" />
              <div>
                <p className="status-label text-mix-blue mb-1">Total Unid</p>
                <p className="data-value text-white">{totals.units}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                if (activeSession) {
                  const updated = { ...activeSession, endTime: Date.now() };
                  db.saveSession(updated);
                  setSessions(db.getSessions());
                  setView('dashboard');
                }
              }}
              className="px-6 py-3 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-all uppercase tracking-widest shadow-lg active:scale-95"
            >
              Finalizar
            </button>
          </div>
        </footer>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isEditingSession && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-app-bg/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass-card w-full max-w-sm p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Editar Relatório</h3>
                <button onClick={() => setIsEditingSession(false)} className="text-slate-500">
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="status-label mb-3 block ml-1">Nome do Inventário</label>
                  <input 
                    type="text"
                    className="input-field"
                    value={newSessionName}
                    onChange={e => setNewSessionName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="status-label mb-3 block ml-1">Setor</label>
                  <select 
                    className="input-field appearance-none"
                    value={newSessionSector}
                    onChange={e => setNewSessionSector(e.target.value)}
                  >
                    {SECTORS.map(s => <option key={s} value={s} className="bg-app-bg">{s}</option>)}
                  </select>
                </div>
                <button 
                  onClick={handleUpdateSession}
                  className="btn-primary w-full"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Tare Modal */}
      <AnimatePresence>
        {isAddingTare && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-app-bg/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass-card w-full max-w-sm p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{editingTareId ? 'Editar Tara' : 'Nova Tara'}</h3>
                <button onClick={() => {
                  setIsAddingTare(false);
                  setEditingTareId(null);
                  setNewTareName('');
                  setNewTareWeight('');
                  setNewTareImage(undefined);
                }} className="text-slate-500">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="status-label mb-3 block ml-1">Nome da Tara</label>
                  <input 
                    type="text"
                    placeholder="Ex: Caixa Azul"
                    className="input-field"
                    value={newTareName}
                    onChange={e => setNewTareName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="status-label mb-3 block ml-1">Peso da Tara (kg)</label>
                  <input 
                    type="number"
                    inputMode="decimal"
                    placeholder="0.000"
                    className="input-field data-value"
                    value={newTareWeight}
                    onChange={e => setNewTareWeight(e.target.value)}
                  />
                </div>
                
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-3xl bg-white/5 relative overflow-hidden min-h-[140px] group transition-all hover:border-mix-blue/30">
                  {newTareImage ? (
                    <img src={newTareImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <>
                      <Upload size={32} className="text-slate-600 mb-2 group-hover:text-mix-blue transition-colors" />
                      <span className="status-label">Upload da imagem da tara</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleImageUpload}
                  />
                </div>

                <button 
                  onClick={handleCreateTare}
                  disabled={!newTareName || !newTareWeight}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {editingTareId ? 'Salvar Alterações' : 'Cadastrar Tara'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddingProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-app-bg/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass-card w-full max-w-sm p-8 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{editingProductId ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => {
                  setIsAddingProduct(false);
                  setEditingProductId(null);
                  setNewProductCode('');
                  setNewProductDesc('');
                }} className="text-slate-500">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="status-label mb-3 block ml-1">Código do Produto</label>
                  <input 
                    type="text"
                    placeholder="Ex: 789123456"
                    className="input-field"
                    value={newProductCode}
                    onChange={e => setNewProductCode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="status-label mb-3 block ml-1">Descrição</label>
                  <input 
                    type="text"
                    placeholder="Ex: Arroz Tio João 5kg"
                    className="input-field"
                    value={newProductDesc}
                    onChange={e => setNewProductDesc(e.target.value)}
                  />
                </div>

                <button 
                  onClick={handleAddProduct}
                  disabled={!newProductCode || !newProductDesc}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {editingProductId ? 'Salvar Alterações' : 'Cadastrar Produto'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
