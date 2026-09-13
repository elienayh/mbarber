import React, { useEffect, useState } from "react";
import { Package, AlertTriangle, Plus, X, Upload, Loader2, Image as ImageIcon, Edit2, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImageFile } from "@/lib/imageUtils";
import { DeleteConfirmModal } from "@/components/common/DeleteConfirmModal";
import { recordAuditLog } from "@/lib/audit";

export const StockPage: React.FC = () => {
  const { tenant } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productToDelete, setProductToDelete] = useState<any | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", sku: "", category: "Geral", cost: "0", sale: "0", stock: "0", minimum: "3" });
  const [productImages, setProductImages] = useState<string[]>([]);
  const [movementForm, setMovementForm] = useState({ type: "in_purchase", quantity: "1" });

  const openProductForm = () => {
    setEditingProduct(null);
    setProductForm({ name: "", sku: "", category: "Geral", cost: "0", sale: "0", stock: "0", minimum: "3" });
    setProductImages([]);
    setError(null);
    setIsProductModalOpen(true);
  };

  const openEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || "",
      sku: product.sku || "",
      category: product.category || "Geral",
      cost: ((product.cost_price_cents || 0) / 100).toFixed(2),
      sale: ((product.sale_price_cents || 0) / 100).toFixed(2),
      stock: String(product.current_stock ?? 0),
      minimum: String(product.min_stock_alert ?? 3),
    });
    const imgs = Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : product.image_url
      ? [product.image_url]
      : [];
    setProductImages(imgs);
    setError(null);
    setIsProductModalOpen(true);
  };

  const openDeleteProduct = (product: any) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async (reason: string) => {
    if (!productToDelete || !tenant?.id) return;
    setDeleteLoading(true);

    try {
      // 1. Tentar RPC no Supabase com auditoria
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("delete_product_with_audit", {
        p_product_id: productToDelete.id,
        p_reason: reason || null,
      });

      if (rpcErr) {
        console.warn("RPC delete_product_with_audit falhou, usando soft delete direto:", rpcErr.message);
        // Fallback: Soft delete direto na tabela
        await (supabase.from("products") as any)
          .update({
            is_active: false,
            deleted_at: new Date().toISOString(),
            deletion_reason: reason || null,
          })
          .eq("id", productToDelete.id);
      }

      // 2. Registrar evento no log de auditoria
      await recordAuditLog({
        tenantId: tenant.id,
        action: "soft_delete",
        entityType: "product",
        entityId: productToDelete.id,
        previousData: productToDelete,
        reason: reason || "Exclusão manual no catálogo de produtos",
      });

      // 3. Atualizar estado local e cache
      setProducts((current) => {
        const next = current.filter((p) => p.id !== productToDelete.id);
        try {
          localStorage.setItem(`mb_products_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      setIsDeleteModalOpen(false);
      setProductToDelete(null);
    } catch (err: any) {
      console.warn("Erro ao excluir produto:", err);
      setError("Erro ao excluir o produto: " + (err?.message || "Tente novamente."));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleImageFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;
    const remainingSlots = 5 - productImages.length;
    if (remainingSlots <= 0) return;
    const filesToUpload: File[] = files.slice(0, remainingSlots);

    setUploadingImages(true);
    const newUrls: string[] = [];

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        const compressedDataUrl = await compressImageFile(file, 512, 0.85);
        let finalUrl = "";
        if (tenant?.id) {
          try {
            const ext = file.name.split(".").pop() || "jpg";
            const storagePath = `${tenant.id}/${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
            const { error: uploadErr } = await supabase.storage
              .from("product-images")
              .upload(storagePath, file, { contentType: file.type, upsert: true });

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage
                .from("product-images")
                .getPublicUrl(storagePath);
              if (publicUrlData?.publicUrl) {
                finalUrl = publicUrlData.publicUrl;
              }
            }
          } catch (storageErr) {
            console.warn("Storage upload failed, using compressed fallback:", storageErr);
          }
        }
        newUrls.push(finalUrl || compressedDataUrl);
      } catch (err) {
        console.warn("Error processing product image:", err);
      }
    }

    setProductImages((prev) => [...prev, ...newUrls].slice(0, 5));
    setUploadingImages(false);
    e.target.value = "";
  };

  const removeProductImage = (indexToRemove: number) => {
    setProductImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
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

    const generatedSku = productForm.sku.trim() || `SKU-${Date.now().toString().slice(-4)}`;
    const mainImageUrl = productImages[0] || null;

    // --- FLUXO DE EDIÇÃO (UPDATE) ---
    if (editingProduct) {
      const updatedProduct = {
        ...editingProduct,
        name: productForm.name.trim(),
        sku: generatedSku,
        category: productForm.category.trim() || "Geral",
        cost_price_cents: Math.round(cost * 100),
        sale_price_cents: Math.round(sale * 100),
        current_stock: stock,
        min_stock_alert: minimum,
        image_url: mainImageUrl,
        images: productImages,
      };

      try {
        const updatePayload: any = {
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          category: updatedProduct.category,
          cost_price_cents: updatedProduct.cost_price_cents,
          sale_price_cents: updatedProduct.sale_price_cents,
          current_stock: updatedProduct.current_stock,
          min_stock_alert: updatedProduct.min_stock_alert,
          image_url: mainImageUrl,
          images: productImages,
        };

        const { error: updateErr } = await (supabase.from("products") as any)
          .update(updatePayload)
          .eq("id", editingProduct.id);

        if (updateErr) {
          console.warn("Supabase update error, falling back without image fields:", updateErr.message);
          delete updatePayload.image_url;
          delete updatePayload.images;
          await (supabase.from("products") as any)
            .update(updatePayload)
            .eq("id", editingProduct.id);
        }
      } catch (err) {
        console.warn("Error updating product on Supabase:", err);
      }

      // Se houve alteração em preço ou estoque, registrar na trilha de auditoria
      const priceChanged = editingProduct.sale_price_cents !== updatedProduct.sale_price_cents ||
                           editingProduct.cost_price_cents !== updatedProduct.cost_price_cents;
      const stockChanged = editingProduct.current_stock !== updatedProduct.current_stock;

      if (priceChanged || stockChanged) {
        await recordAuditLog({
          tenantId: tenant.id,
          action: "update",
          entityType: "product",
          entityId: editingProduct.id,
          previousData: editingProduct,
          newData: updatedProduct,
          reason: `Alteração de produto: ${priceChanged ? "Preços alterados. " : ""}${stockChanged ? `Estoque alterado para ${stock} un.` : ""}`,
        });
      }

      setProducts((current) => {
        const next = current.map((p) => (p.id === editingProduct.id ? updatedProduct : p));
        try {
          localStorage.setItem(`mb_products_${tenant.id}`, JSON.stringify(next));
        } catch {}
        return next;
      });

      setSaving(false);
      setIsProductModalOpen(false);
      setEditingProduct(null);
      return;
    }

    // --- FLUXO DE CADASTRO (INSERT) ---
    let createdProduct: any = null;
    try {
      const payload: any = {
        tenant_id: tenant.id,
        name: productForm.name.trim(),
        sku: generatedSku,
        category: productForm.category.trim() || "Geral",
        cost_price_cents: Math.round(cost * 100),
        sale_price_cents: Math.round(sale * 100),
        current_stock: stock,
        min_stock_alert: minimum,
        is_active: true,
        image_url: mainImageUrl,
        images: productImages,
      };

      let { data, error: saveError } = await (supabase.from("products") as any)
        .insert(payload)
        .select()
        .single();

      if (saveError && (saveError.message?.includes("image_url") || saveError.message?.includes("images"))) {
        delete payload.image_url;
        delete payload.images;
        const retry = await (supabase.from("products") as any).insert(payload).select().single();
        if (!retry.error && retry.data) {
          data = { ...retry.data, image_url: mainImageUrl, images: productImages };
          saveError = null;
        }
      }

      if (!saveError && data) {
        createdProduct = {
          ...data,
          image_url: data.image_url || mainImageUrl,
          images: data.images || productImages,
        };
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
        sku: generatedSku,
        category: productForm.category.trim() || "Geral",
        cost_price_cents: Math.round(cost * 100),
        sale_price_cents: Math.round(sale * 100),
        current_stock: stock,
        min_stock_alert: minimum,
        is_active: true,
        image_url: mainImageUrl,
        images: productImages,
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

      try {
        const { data, error: loadError } = await (supabase.from("products") as any)
          .select("id, name, sku, category, cost_price_cents, sale_price_cents, current_stock, min_stock_alert, image_url, images")
          .eq("tenant_id", tenant.id)
          .eq("is_active", true)
          .order("name");

        if (!loadError && data) {
          setProducts(data);
          try {
            localStorage.setItem(`mb_products_${tenant.id}`, JSON.stringify(data));
          } catch {}
        } else if (loadError) {
          // Fallback if image_url column not yet in remote DB schema
          const fallback = await (supabase.from("products") as any)
            .select("id, name, sku, category, cost_price_cents, sale_price_cents, current_stock, min_stock_alert")
            .eq("tenant_id", tenant.id)
            .eq("is_active", true)
            .order("name");

          if (!fallback.error && fallback.data) {
            setProducts(fallback.data);
          }
        }
      } catch (err) {
        console.warn("Error loading products:", err);
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
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">Produtos & Estoque</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-100 text-slate-700">
              Catálogo
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Controle de mercadorias para revenda no balcão, agendamentos e insumos da barbearia
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
          {loading && <div className="px-4 py-10 text-center text-sm text-slate-500">Carregando catálogo de produtos...</div>}
          {!loading && products.length === 0 && <div className="px-4 py-10 text-center text-sm text-slate-500">Nenhum produto cadastrado.</div>}
          {!loading && products.map((product) => {
            const isLowStock = product.current_stock <= product.min_stock_alert;
            const displayImage = product.image_url || (Array.isArray(product.images) && product.images[0]) || null;
            return (
              <article key={product.id} className="px-4 py-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {displayImage ? (
                      <img
                        src={displayImage}
                        alt={product.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                        <Package className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-900">{product.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {product.category || "Geral"} {product.sku ? `• ${product.sku}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-right font-black text-slate-900">
                    {product.sale_price_cents > 0 ? formatCurrency(product.sale_price_cents) : "Uso interno"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${isLowStock ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {isLowStock && <AlertTriangle className="w-3 h-3" />}
                    {product.current_stock} un {isLowStock ? "· estoque baixo" : "disponíveis"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openMovementForm(product)}
                      className="h-9 rounded-xl surface-elevated-light px-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-200"
                    >
                      Estoque
                    </button>
                    <button
                      onClick={() => openEditProduct(product)}
                      className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center justify-center"
                      title="Editar produto"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteProduct(product)}
                      className="h-9 w-9 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition flex items-center justify-center"
                      title="Excluir produto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Preço de Custo</th>
                <th className="py-3.5 px-4">Preço de Venda</th>
                <th className="py-3.5 px-4">Estoque Atual</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && <tr><td colSpan={6} className="py-8 text-center text-slate-500">Carregando catálogo de produtos...</td></tr>}
              {!loading && products.map((p) => {
                const isLowStock = p.current_stock <= p.min_stock_alert;
                const displayImage = p.image_url || (Array.isArray(p.images) && p.images[0]) || null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt={p.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {p.sku || "Sem SKU"}
                          </div>
                          {isLowStock && (
                            <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              Abaixo do mínimo ({p.min_stock_alert} un)
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">{p.category || "Geral"}</td>
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
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => openMovementForm(p)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg surface-elevated-light hover:bg-slate-200 text-slate-800 transition"
                        >
                          Entrada / Saída
                        </button>
                        <button
                          onClick={() => openEditProduct(p)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                          title="Editar produto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteProduct(p)}
                          className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition"
                          title="Excluir produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? "Editar Produto" : "Novo Produto"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingProduct
                    ? "Atualize as informações, fotos, preços e estoque do item"
                    : "Cadastre itens para venda no balcão ou agendamento"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  setEditingProduct(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveProduct} className="space-y-4 pt-4">
              {/* Fotos do Produto */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Fotos do Produto <span className="text-slate-400 font-normal">({productImages.length}/5)</span>
                  </label>
                  {productImages.length > 0 && (
                    <span className="text-[10px] font-medium text-slate-500">A 1ª foto é a capa principal</span>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2.5 items-center">
                  {productImages.map((imgUrl, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-200 overflow-hidden group bg-slate-50 shrink-0">
                      <img src={imgUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute bottom-0 inset-x-0 bg-accent text-slate-950 font-black text-[9px] text-center py-0.5 leading-none">
                          Principal
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeProductImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-600 transition"
                        title="Remover foto"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {productImages.length < 5 && (
                    <label className={`w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center cursor-pointer transition text-slate-400 hover:text-slate-600 shrink-0 ${uploadingImages ? "opacity-50 pointer-events-none" : ""}`}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageFilesSelect}
                        className="hidden"
                        disabled={uploadingImages}
                      />
                      {uploadingImages ? (
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span className="text-[9px] font-semibold mt-0.5">Anexar</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Formatos aceitos: JPG, PNG, WEBP (máx. 5 imagens)</p>
              </div>

              {/* Nome do Produto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Produto <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={productForm.name}
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                  placeholder="Ex: Pomada Modeladora Efeito Matte"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              {/* Preço de Custo e Preço de Venda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preço de Custo (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.cost}
                    onChange={(event) => setProductForm({ ...productForm, cost: event.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Preço de Venda (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.sale}
                    onChange={(event) => setProductForm({ ...productForm, sale: event.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                </div>
              </div>

              {/* Quantidade em Estoque e Estoque Mínimo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantidade em Estoque <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={productForm.stock}
                    onChange={(event) => setProductForm({ ...productForm, stock: event.target.value })}
                    placeholder="0"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estoque Mínimo (Alerta) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={productForm.minimum}
                    onChange={(event) => setProductForm({ ...productForm, minimum: event.target.value })}
                    placeholder="3"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 transition"
                  />
                </div>
              </div>

              <button
                disabled={saving || uploadingImages}
                className="w-full rounded-xl bg-accent py-3 font-bold text-slate-950 hover:bg-accent/90 disabled:opacity-50 transition shadow-md shadow-accent flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving
                  ? "Salvando Produto..."
                  : editingProduct
                  ? "Salvar Alterações"
                  : "Cadastrar Produto"}
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

      {/* Modal de confirmação de exclusão auditada com anti-fraude */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDeleteProduct}
        title="Excluir Produto"
        itemDescription={
          productToDelete
            ? `${productToDelete.name} (${productToDelete.sku || "Sem SKU"}) - Estoque atual: ${productToDelete.current_stock ?? 0} un.`
            : ""
        }
        warningMessage="Esta exclusão será registrada permanentemente na trilha de auditoria e anti-fraude da barbearia. O histórico de movimentações e vendas passadas permanecerá intacto para fins fiscais e financeiros."
        requireReason={false}
        loading={deleteLoading}
      />
    </div>
  );
};
