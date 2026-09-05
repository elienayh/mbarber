import React, { useState } from "react";
import { Package, AlertTriangle, Plus, ArrowDown, ArrowUp, Search } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const StockPage: React.FC = () => {
  const [products, setProducts] = useState([
    {
      id: "pr1",
      name: "Pomada Modeladora Efeito Matte 150g",
      sku: "POM-MAT-01",
      category: "Pomadas",
      cost_price_cents: 2200,
      sale_price_cents: 6500,
      current_stock: 14,
      min_stock_alert: 5,
    },
    {
      id: "pr2",
      name: "Óleo para Barba Hidratante 30ml",
      sku: "OLE-BAR-02",
      category: "Óleos",
      cost_price_cents: 1800,
      sale_price_cents: 4500,
      current_stock: 8,
      min_stock_alert: 4,
    },
    {
      id: "pr3",
      name: "Shampoo Anticaspa Fortalecedor 250ml",
      sku: "SHA-FOR-03",
      category: "Shampoo",
      cost_price_cents: 2500,
      sale_price_cents: 5500,
      current_stock: 2,
      min_stock_alert: 5, // Alert!
    },
    {
      id: "pr4",
      name: "Navalhetes Descartáveis Aço Inox (Caixa 100un)",
      sku: "NAV-DES-04",
      category: "Insumos Bancada",
      cost_price_cents: 3200,
      sale_price_cents: 0, // Uso interno
      current_stock: 6,
      min_stock_alert: 3,
    },
  ]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Estoque & Produtos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle de mercadorias para revenda no balcão e insumos de uso interno
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-md shadow-amber-500/20 flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto</span>
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Produto</th>
                <th className="py-3.5 px-4">SKU</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Preço de Custo</th>
                <th className="py-3.5 px-4">Preço de Venda</th>
                <th className="py-3.5 px-4">Estoque Atual</th>
                <th className="py-3.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {products.map((p) => {
                const isLowStock = p.current_stock <= p.min_stock_alert;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      {isLowStock && (
                        <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Estoque abaixo do mínimo ({p.min_stock_alert} un)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{p.sku}</td>
                    <td className="py-3.5 px-4 text-xs">{p.category}</td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      {formatCurrency(p.cost_price_cents)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {p.sale_price_cents > 0 ? formatCurrency(p.sale_price_cents) : "Uso Interno"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          isLowStock
                            ? "bg-red-100 text-red-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {p.current_stock} un
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <button className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition">
                        Entrada / Saída
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
