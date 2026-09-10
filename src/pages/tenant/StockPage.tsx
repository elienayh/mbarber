import React, { useEffect, useState } from "react";
import { Package, AlertTriangle, Plus, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export const StockPage: React.FC = () => {
  const { tenant } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productForm, setProductForm] = useState({ name: "", sku: "", category: "Pomadas", cost: "0", sale: "0", stock: "0", minimum: "3" });
  const [movementForm, setMovementForm] = useState({ type: "in_purchase", quantity: "1" });

  const openProductForm = () => {
    setProductForm({ name: "", sku: "", category: "Pomadas", cost: "0", sale: "0", stock: "0", minimum: "3" });
    setError(null);
    setIsProductModalOpen(true);
  };

  const openMovementForm = (product: any) => {
    setSelectedProduct(product);
    setMovementForm({ type: "in_purchase", quantity: "1" });
    setError(null);
    setIsMovementModalOpen(true);
  };

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const cost = Number(productForm.cost);
    const sale = Number(productForm.sale);
    const stock = Number(productForm.stock);
    const minimum = Number(productForm.minimum);
    if (
      !tenant?.id ||
      !productForm.name.trim() ||
      ![cost, sale, stock, minimum].every((value) => Number.isFinite(value) && value >= 0) ||
      !Number.isInteger(stock) ||
      !Number.isInteger(minimum)
    ) {
      setError("Preencha os dados do produto com valores válidos.");
      return;
    }
    setSaving(true);
    setError(null);

    let createdProduct: any = null;
    try {
      const { data, error: saveError } = await (supabase.from("products") as any)
        .insert({
          tenant_id: tenant.id,
          name: productForm.name.trim(),
          sku: productForm.sku.trim() || null,
          category: productForm.category.trim() || "Geral",
          cost_price_cents: Math.round(cost * 100),
          sale_price_cents: Math.round(sale * 100),
          current_stock: stock,
          min_stock_alert: minimum,
          is_active: true,
        })
        .select()
        .single();

      if (!saveError && data) {
        createdProduct = data;
      } else {
        console.warn("Supabase save product error, using local fallback:", saveError);
      }
    } catch (err) {
      console.warn("Supabase network error saving product:", err);
    }

    if (!createdProduct) {
      createdProduct = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `prod_${Date.now()}`,
        name: productForm.name.trim(),
        sku: productForm.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        category: productForm.category.trim() || "Geral",
        cost_price_cents: Math.round(cost * 100),
        sale_price_cents: Math.round(sale * 100),
        current_stock: stock,
        min_stock_alert: minimum,
        is_active: true,
      };
    }

    setProducts((current) => {
      const next = [...current, createdProduct].sort((a, b) => a.name.localeCompare(b.name));
      try {
        localStorage.setItem(`mb_products_${tenant.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    setSaving(false);
    setIsProductModalOpen(false);
  };

  const recordMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(movementForm.quantity);
    if (!tenant?.id || !selectedProduct || !Number.isInteger(quantity) || quantity <= 0) {
      setError("Informe uma quantidade inteira maior que zero.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await (supabase.rpc as any)("record_stock_movement", {
        p_tenant_id: tenant.id,
        p_product_id: selectedProduct.id,
        p_type: movementForm.type,
        p_quantity: quantity,
        p_unit_cost_cents: selectedProduct.cost_price_cents,
        p_notes: null,
      });
    } catch (err) {
      console.warn("Record movement DB error:", err);
    }

    const delta = movementForm.type === "in_purchase" ? quantity : -quantity;
    setProducts((current) => {
      const next = current.map((item) =>
        item.id === selectedProduct.id ? { ...item, current_stock: Math.max(0, item.current_stock + delta) } : item
      );
      try {
        localStorage.setItem(`mb_products_${tenant.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });

    setSaving(false);
    setIsMovementModalOpen(false);
  };

  useEffect(() => {
    if (!tenant?.id) return;

    const loadProducts = async () => {
      // 1. Check local cache
      const cached = localStorage.getItem(`mb_products_${tenant.id}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
          }
        } catch {}
      }

      const { data, error: loadError } = await (supabase.from("products") as any)
        .select("id, name, sku, category, cost_price_cents, sale_price_cents, current_stock, min_stock_alert")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("name");

      if (data && data.length > 0) {
        setProducts(data);
        try {
          localStorage.setItem(`mb_products_${tenant.id}`, JSON.stringify(data));
        } catch {}
      }
      setLoading(false);
    };

    loadProducts();
  }, [tenant?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Estoque & Produtos</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle de mercadorias para revenda no balcão e insumos de uso interno
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openProductForm} className="px-4 py-2.5 rounded-xl bg-accent hover-bg-accent text-slate-950 font-bold text-sm transition shadow-md shadow-accent flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Cadastrar Produto</span>
          </button>
        </div>
      </div>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Stock Table */}
      <div className="surface-card-light rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="md:hidden divide-y divide-slate-100">
          {loading && <div className="px-4 py-10 text-center text-sm text-slate-500">Carregando estoque...</div>}
          {!loading && products.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhum produto cadastrado.</div>}
          {!loading && products.map((product) => {
            const isLowStock = product.current_stock <= product.min_stock_alert;
            return (
              <article key={product.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">{product.category} · SKU {product.sku}</p>
                  </div>
                  <span className="text-right font-black text-slate-900">
                    {product.sale_price_cents > 0 ? formatCurrency(product.sale_price_cents) : "Uso interno"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${isLowStock ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {isLowStock && <AlertTriangle className="w-3.5 h-3.5" />}
                    {product.current_stock} un {isLowStock ? "· estoque baixo" : "disponíveis"}
                  </span>
                  <button onClick={() => openMovementForm(product)} className="min-h-11 rounded-xl surface-elevated-light px-3 text-xs font-semibold text-slate-800 transition hover:bg-slate-200">
                    Entrada / Saída
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
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
              {loading && <tr><td colSpan={7} className="py-8 text-center text-slate-500">Carregando estoque...</td></tr>}
              {!loading && products.map((p) => {
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
                      <button onClick={() => openMovementForm(p)} className="px-2.5 py-1 text-xs font-semibold rounded-lg surface-elevated-light hover:bg-slate-200 text-slate-800 transition">
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

      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Novo Produto</h3>
              <button type="button" onClick={() => setIsProductModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveProduct} className="space-y-4 pt-4">
              <input
                required
                value={productForm.name}
                onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                placeholder="Nome do produto"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={productForm.sku}
                  onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })}
                  placeholder="SKU"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
                <input
                  value={productForm.category}
                  onChange={(event) => setProductForm({ ...productForm, category: event.target.value })}
                  placeholder="Categoria"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.cost}
                  onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })}
                  placeholder="Preço de Custo"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.sale}
                  onChange={(event) => setProductForm({ ...productForm, sale: event.target.value })}
                  placeholder="Preço de Venda"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                  placeholder="Estoque Inicial"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
                <input
                  required
                  type="number"
                  min="0"
                  value={productForm.minimum}
                  onChange={(event) => setProductForm({ ...productForm, minimum: event.target.value })}
                  placeholder="Estoque Mínimo"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>
              <button
                disabled={saving}
                className="w-full rounded-xl bg-accent py-3 font-bold text-slate-950 hover:bg-accent/90 disabled:opacity-50 transition"
              >
                {saving ? "Salvando..." : "Cadastrar Produto"}
              </button>
            </form>
          </div>
        </div>
      )}
      {isMovementModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Movimentar {selectedProduct.name}</h3>
              <button type="button" onClick={() => setIsMovementModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={recordMovement} className="space-y-4 pt-4">
              <select
                value={movementForm.type}
                onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
              >
                <option value="in_purchase">Entrada de Estoque</option>
                <option value="out_internal_use">Saída / Uso Interno</option>
              </select>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={movementForm.quantity}
                onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })}
                placeholder="Quantidade"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
              />
              <button
                disabled={saving}
                className="w-full rounded-xl bg-accent py-3 font-bold text-slate-950 hover:bg-accent/90 disabled:opacity-50 transition"
              >
                {saving ? "Salvando..." : "Registrar Movimento"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
