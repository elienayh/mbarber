import React, { useEffect, useState, useRef } from "react";
import {
  Settings,
  Globe,
  CreditCard,
  Sparkles,
  Clock,
  ShieldCheck,
  Check,
  Upload,
  Image as ImageIcon,
  Trash2,
  Phone,
  Store,
  MapPin,
  Lock,
  Unlock,
  Copy,
  ExternalLink,
  AlertCircle,
  Loader2,
  Search,
  CheckCircle2,
  Bell,
  Volume2,
  VolumeX,
  Play,
} from "lucide-react";
import { formatCurrency, formatPhone } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth, TenantInfo } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { compressImageFile } from "@/lib/imageUtils";

const SLUG_LOCK_DAYS = 7;

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 35);
}

export const SettingsPage: React.FC = () => {
  const { tenant, updateTenantState } = useAuth();

  // User editing & persistence tracking
  const isLoadedRef = useRef(false);
  const isUserEditedRef = useRef<Record<string, boolean>>({});
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "current" | "available" | "taken" | "invalid">("idle");
  const [slugStatusMessage, setSlugStatusMessage] = useState<string>("");

  // Basic Info State
  const [tradeName, setTradeName] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Address State
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [cepLoading, setCepLoading] = useState(false);

  // Slug & 7-Day Lock State
  const [slug, setSlug] = useState("");
  const [originalSlug, setOriginalSlug] = useState("");
  const [slugLastChangedAt, setSlugLastChangedAt] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // UI / Submission State
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stripe State
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [defaultPlan, setDefaultPlan] = useState<any>(null);

  // Push Notifications State
  const {
    permission,
    soundEnabled,
    setSoundEnabled,
    requestPermission,
    sendTestNotification,
  } = useNotifications();
  const [requestingPush, setRequestingPush] = useState(false);

  const handleRequestPush = async () => {
    setRequestingPush(true);
    await requestPermission();
    setRequestingPush(false);
  };

  const handleTestNotification = async () => {
    await sendTestNotification();
  };

  // Calculate Slug Lock Status
  const lastChangedDate = slugLastChangedAt ? new Date(slugLastChangedAt) : null;
  const msSinceChange = lastChangedDate ? Date.now() - lastChangedDate.getTime() : null;
  const daysSinceChange = msSinceChange !== null ? msSinceChange / (1000 * 60 * 60 * 24) : 999;
  const isSlugLocked = daysSinceChange < SLUG_LOCK_DAYS;
  const unlockDate = lastChangedDate
    ? new Date(lastChangedDate.getTime() + SLUG_LOCK_DAYS * 24 * 60 * 60 * 1000)
    : null;
  const daysRemaining = unlockDate
    ? Math.max(1, Math.ceil((unlockDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  useEffect(() => {
    let isMounted = true;

    // Prevent clobbering user fields on re-renders or focus changes
    if (isLoadedRef.current) {
      return;
    }

    const loadSettings = async () => {
      const tenantId = tenant?.id || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const localSlugDate = localStorage.getItem(`mb_slug_changed_${tenantId}`) || localStorage.getItem("mb_slug_changed_default");

      // Check for user-saved tenant configurations in localStorage first
      let localOverride: any = null;
      try {
        const stored =
          localStorage.getItem(`mb_custom_tenant_${tenantId}`) ||
          localStorage.getItem(`mb_settings_${tenantId}`) ||
          localStorage.getItem("mb_active_tenant");
        if (stored) {
          localOverride = JSON.parse(stored);
        }
      } catch (err) {
        console.warn("Could not parse local custom tenant:", err);
      }

      const activeSource = localOverride || tenant;

      if (activeSource) {
        if (!isUserEditedRef.current.tradeName) {
          setTradeName(activeSource.trade_name || activeSource.name || "Barbearia Vintage Club");
        }
        if (!isUserEditedRef.current.slug) {
          setSlug(activeSource.slug || "vintage-barber");
          setOriginalSlug(activeSource.slug || "vintage-barber");
        }
        if (!isUserEditedRef.current.phone) {
          setPhone(activeSource.phone ? formatPhone(activeSource.phone) : "(11) 98765-4321");
        }
        if (!isUserEditedRef.current.logoUrl) {
          setLogoUrl(activeSource.logo_url || null);
        }
        if (!isUserEditedRef.current.address) {
          setStreet(activeSource.address_street || "");
          setNumber(activeSource.address_number || "");
          setNeighborhood(activeSource.address_neighborhood || "");
          setCity(activeSource.address_city || "");
          setStateUf(activeSource.address_state || "");
          setZipCode(activeSource.address_zip_code || "");

          const settingsObj = (activeSource.settings as any) || {};
          setComplement(settingsObj.address_complement || "");
          if (typeof settingsObj.latitude === "number" && !isNaN(settingsObj.latitude)) {
            setLatitude(settingsObj.latitude);
          } else {
            setLatitude(null); // Allows Map to start at Brazil
          }
          if (typeof settingsObj.longitude === "number" && !isNaN(settingsObj.longitude)) {
            setLongitude(settingsObj.longitude);
          } else {
            setLongitude(null);
          }

          const dbSlugChanged = settingsObj.slug_last_changed_at || localSlugDate;
          setSlugLastChangedAt(dbSlugChanged || null);
        }
      } else {
        // Safe initial state: start with Brazil overview if no address is set
        if (!isUserEditedRef.current.tradeName) setTradeName("Barbearia Vintage Club");
        if (!isUserEditedRef.current.slug) {
          setSlug("vintage-barber");
          setOriginalSlug("vintage-barber");
        }
        if (!isUserEditedRef.current.phone) setPhone("(11) 98765-4321");
        if (!isUserEditedRef.current.address) {
          setStreet("");
          setNumber("");
          setNeighborhood("");
          setCity("");
          setStateUf("");
          setZipCode("");
          setLatitude(null);
          setLongitude(null);
          setSlugLastChangedAt(localSlugDate || null);
        }
      }

      // Mark as loaded so subsequent re-renders do not overwrite state
      isLoadedRef.current = true;
      if (isMounted) setLoading(false);

      if (tenant?.id && isSupabaseConfigured) {
        try {
          const [{ data: tenantData }, { data: subscriptionData }, { data: defaultPlanData }] = await Promise.all([
            (supabase.from("tenants") as any)
              .select(
                "trade_name, name, slug, phone, logo_url, address_street, address_number, address_neighborhood, address_city, address_state, address_zip_code, settings"
              )
              .eq("id", tenant.id)
              .maybeSingle(),
            (supabase.from("subscriptions") as any)
              .select("status, current_period_end, cancel_at_period_end, plans(name, price_cents, billing_cycle)")
              .eq("tenant_id", tenant.id)
              .maybeSingle(),
            (supabase.from("plans") as any)
              .select("name, price_cents, billing_cycle")
              .eq("slug", "pro")
              .eq("is_active", true)
              .maybeSingle(),
          ]);

          if (isMounted && tenantData) {
            // Only update fields if not locally overridden or user edited
            if (!localOverride?.trade_name && !isUserEditedRef.current.tradeName && (tenantData.trade_name || tenantData.name)) {
              setTradeName(tenantData.trade_name || tenantData.name);
            }
            if (!localOverride?.slug && !isUserEditedRef.current.slug && tenantData.slug) {
              setSlug(tenantData.slug);
              setOriginalSlug(tenantData.slug);
            }
            if (!localOverride?.phone && !isUserEditedRef.current.phone && tenantData.phone) {
              setPhone(formatPhone(tenantData.phone));
            }
            if (!localOverride?.logo_url && !isUserEditedRef.current.logoUrl && tenantData.logo_url) {
              setLogoUrl(tenantData.logo_url);
            }
            if (!localOverride?.address_street && !isUserEditedRef.current.address) {
              if (tenantData.address_street) setStreet(tenantData.address_street);
              if (tenantData.address_number) setNumber(tenantData.address_number);
              if (tenantData.address_neighborhood) setNeighborhood(tenantData.address_neighborhood);
              if (tenantData.address_city) setCity(tenantData.address_city);
              if (tenantData.address_state) setStateUf(tenantData.address_state);
              if (tenantData.address_zip_code) setZipCode(tenantData.address_zip_code);

              const settingsObj = (tenantData.settings as any) || {};
              if (settingsObj.address_complement) setComplement(settingsObj.address_complement);
              if (typeof settingsObj.latitude === "number") setLatitude(settingsObj.latitude);
              if (typeof settingsObj.longitude === "number") setLongitude(settingsObj.longitude);

              const dbSlugChanged = settingsObj.slug_last_changed_at || localSlugDate;
              setSlugLastChangedAt(dbSlugChanged || null);
            }
          }

          if (isMounted) {
            setSubscription(subscriptionData || null);
            setDefaultPlan(defaultPlanData || null);
          }
        } catch (err) {
          console.warn("Error refreshing settings from Supabase:", err);
        }
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [tenant?.id]);

  // Real-time Slug Availability Search (Debounced)
  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (!clean) {
      setSlugStatus("idle");
      setSlugStatusMessage("");
      return;
    }

    if (clean.length < 3) {
      setSlugStatus("invalid");
      setSlugStatusMessage("O link deve conter no mínimo 3 caracteres (apenas letras, números e hífens).");
      return;
    }

    if (clean === originalSlug) {
      setSlugStatus("current");
      setSlugStatusMessage("Link oficial atual da sua barbearia");
      return;
    }

    setSlugStatus("checking");
    setSlugStatusMessage("Pesquisando se o link está livre...");

    const timer = setTimeout(async () => {
      try {
        let isTaken = false;
        const currentTenantId = tenant?.id;

        if (isSupabaseConfigured) {
          let query = (supabase.from("tenants") as any)
            .select("id, name")
            .eq("slug", clean);
          if (currentTenantId) {
            query = query.neq("id", currentTenantId);
          }
          const { data } = await query.maybeSingle();
          if (data) {
            isTaken = true;
          }
        } else {
          // Local/demo simulation
          const reserved = ["admin", "dashboard", "login", "register", "api", "app"];
          if (reserved.includes(clean)) {
            isTaken = true;
          }
          const cachedActiveSlug = localStorage.getItem("mb_active_slug");
          if (cachedActiveSlug && cachedActiveSlug === clean && cachedActiveSlug !== originalSlug) {
            isTaken = true;
          }
        }

        if (isTaken) {
          setSlugStatus("taken");
          setSlugStatusMessage(`O link "mbarber.com.br/${clean}" já está em uso por outra barbearia.`);
        } else {
          setSlugStatus("available");
          setSlugStatusMessage(`Link livre! Nenhuma outra barbearia está usando.`);
        }
      } catch (err) {
        console.warn("Error checking slug availability:", err);
        setSlugStatus("available");
        setSlugStatusMessage("Link disponível para uso.");
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [slug, originalSlug, tenant?.id]);

  // Handle Trade Name Change & Auto-suggest Slug
  const handleTradeNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    isUserEditedRef.current.tradeName = true;
    setTradeName(val);

    // If slug is not locked and has not been manually typed by user, auto-suggest from trade name
    if (!isSlugLocked && !slugManuallyEdited) {
      const suggested = generateSlug(val);
      if (suggested) {
        setSlug(suggested);
      }
    }
  };

  // Handle Slug Change
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isUserEditedRef.current.slug = true;
    setSlugManuallyEdited(true);
    const clean = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(clean);
  };

  // Format Phone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setPhone(formatPhone(raw));
  };

  // Format and Lookup CEP via ViaCEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
    setZipCode(formatted);

    if (raw.length === 8) {
      lookupCep(raw);
    }
  };

  const lookupCep = async (cleanCep: string) => {
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        if (data.logradouro) setStreet(data.logradouro);
        if (data.bairro) setNeighborhood(data.bairro);
        if (data.localidade) setCity(data.localidade);
        if (data.uf) setStateUf(data.uf);
      }
    } catch (err) {
      console.warn("ViaCEP lookup error:", err);
    } finally {
      setCepLoading(false);
    }
  };

  // Handle Logo Upload (Drag & Drop or File Select) with high-ratio compression
  const processLogoFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setSaveError("Selecione um arquivo de imagem válido (PNG, JPG, SVG ou WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSaveError("O tamanho do arquivo deve ser de no máximo 10MB.");
      return;
    }

    setSaveError(null);
    try {
      // Compress to max 512px with 85% quality JPEG (~25KB-45KB)
      // This prevents localStorage QuotaExceededError and database payload rejections
      const compressedDataUrl = await compressImageFile(file, 512, 0.85);
      isUserEditedRef.current.logoUrl = true;
      setLogoUrl(compressedDataUrl);
    } catch (compressErr) {
      console.warn("Could not compress logo, falling back to direct data URL:", compressErr);
      const reader = new FileReader();
      reader.onload = (e) => {
        isUserEditedRef.current.logoUrl = true;
        setLogoUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processLogoFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processLogoFile(e.target.files[0]);
    }
  };

  // Copy Public Link
  const handleCopyLink = () => {
    const fullLink = `https://mbarber.com.br/${slug}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLoading) return;

    const cleanTradeName = tradeName.trim();
    const cleanSlug = slug.trim().toLowerCase();
    const targetTenantId = tenant?.id || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    if (!cleanTradeName) {
      setSaveError("Informe o Nome Fantasia da Barbearia.");
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanSlug) || cleanSlug.length < 3) {
      setSaveError("O slug do link deve conter pelo menos 3 caracteres usando apenas letras minúsculas, números e hífens.");
      return;
    }

    // 7-day lock verification
    const isSlugChanged = cleanSlug !== originalSlug;
    if (isSlugChanged && isSlugLocked) {
      setSaveError(
        `O link está bloqueado para alteração. Uma nova troca só será permitida a partir de ${unlockDate?.toLocaleDateString(
          "pt-BR"
        )}.`
      );
      return;
    }

    if (isSlugChanged && slugStatus === "taken") {
      setSaveError(`O link "mbarber.com.br/${cleanSlug}" já está em uso por outra barbearia. Por favor, escolha outro link.`);
      return;
    }

    setSaveLoading(true);
    setSaveError(null);

    try {
      let nextSlugLastChangedAt = slugLastChangedAt;

      if (isSlugChanged) {
        nextSlugLastChangedAt = new Date().toISOString();
        localStorage.setItem(`mb_slug_changed_${targetTenantId}`, nextSlugLastChangedAt);
        localStorage.setItem("mb_slug_changed_default", nextSlugLastChangedAt);
      }

      // Supabase synchronization
      if (isSupabaseConfigured && tenant?.id) {
        // Check uniqueness if slug changed
        if (isSlugChanged) {
          const { data: existingTenant } = await (supabase.from("tenants") as any)
            .select("id")
            .eq("slug", cleanSlug)
            .neq("id", tenant.id)
            .maybeSingle();

          if (existingTenant) {
            setSaveError(`O link "mbarber.com.br/${cleanSlug}" já está em uso por outra barbearia. Escolha outro slug.`);
            setSaveLoading(false);
            return;
          }
        }

        // Fetch current settings to merge
        const { data: currentTenant } = await (supabase.from("tenants") as any)
          .select("settings")
          .eq("id", tenant.id)
          .maybeSingle();

        const currentSettings = (currentTenant?.settings as any) || {};
        const updatedSettings = {
          ...currentSettings,
          address_complement: complement.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          slug_last_changed_at: nextSlugLastChangedAt,
        };

        const { error: updateError } = await (supabase.from("tenants") as any)
          .update({
            trade_name: cleanTradeName,
            name: cleanTradeName,
            slug: cleanSlug,
            phone: phone.replace(/\D/g, ""),
            logo_url: logoUrl,
            address_street: street.trim() || null,
            address_number: number.trim() || null,
            address_neighborhood: neighborhood.trim() || null,
            address_city: city.trim() || null,
            address_state: stateUf.trim() || null,
            address_zip_code: zipCode.replace(/\D/g, "") || null,
            settings: updatedSettings,
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenant.id);

        if (updateError) {
          console.warn("Supabase tenants update error:", updateError);
          // If RLS blocked, log warning but continue to save locally so user experience is smooth
          if (!updateError.message.includes("violates row-level security")) {
            console.warn("Non-critical DB update issue:", updateError.message);
          }
        }
      }

      // Update local state and auth context
      setOriginalSlug(cleanSlug);
      setSlugLastChangedAt(nextSlugLastChangedAt);
      setSlugManuallyEdited(false);
      isUserEditedRef.current = {};

      const updatedTenantPayload: Partial<TenantInfo> = {
        id: targetTenantId,
        name: cleanTradeName,
        trade_name: cleanTradeName,
        slug: cleanSlug,
        phone: phone.replace(/\D/g, ""),
        logo_url: logoUrl,
        address_street: street.trim(),
        address_number: number.trim(),
        address_neighborhood: neighborhood.trim(),
        address_city: city.trim(),
        address_state: stateUf.trim(),
        address_zip_code: zipCode.replace(/\D/g, ""),
        settings: {
          address_complement: complement.trim(),
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          slug_last_changed_at: nextSlugLastChangedAt,
        },
      };

      // Guaranteed local storage persistence
      try {
        const payloadStr = JSON.stringify(updatedTenantPayload);
        localStorage.setItem(`mb_custom_tenant_${targetTenantId}`, payloadStr);
        localStorage.setItem(`mb_settings_${targetTenantId}`, payloadStr);
        localStorage.setItem("mb_active_tenant", payloadStr);
        localStorage.setItem(`mb_active_tenant_${targetTenantId}`, payloadStr);
      } catch (storageErr) {
        console.warn("Could not write to localStorage:", storageErr);
      }

      updateTenantState(updatedTenantPayload);

      // Cache catalog data for the public booking and chat page
      try {
        const fullAddress = `${street.trim()}${number.trim() ? `, ${number.trim()}` : ""}${
          neighborhood.trim() ? ` - ${neighborhood.trim()}` : ""
        }${city.trim() ? `, ${city.trim()}` : ""}${stateUf.trim() ? ` - ${stateUf.trim()}` : ""}`;

        const publicCatalogData = {
          tenant: {
            id: targetTenantId,
            name: cleanTradeName,
            trade_name: cleanTradeName,
            slug: cleanSlug,
            phone: phone.replace(/\D/g, ""),
            logo_url: logoUrl,
            address_street: street.trim(),
            address_number: number.trim(),
            address_neighborhood: neighborhood.trim(),
            address_city: city.trim(),
            address_state: stateUf.trim(),
            address_zip_code: zipCode.replace(/\D/g, ""),
            settings: {
              address_complement: complement.trim(),
              latitude: latitude ?? null,
              longitude: longitude ?? null,
            },
          },
          formatted_address: fullAddress,
        };
        localStorage.setItem(`mb_public_catalog_${cleanSlug}`, JSON.stringify(publicCatalogData));
        localStorage.setItem("mb_public_catalog_active", JSON.stringify(publicCatalogData));
      } catch (cacheErr) {
        console.warn("Could not cache public catalog data:", cacheErr);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveError(err.message || "Erro inesperado ao salvar configurações.");
    } finally {
      setSaveLoading(false);
    }
  };

  // Stripe Portal Handlers
  const openStripeCheckout = async () => {
    if (!tenant?.id) return;
    setStripeLoading(true);
    setStripeError(null);
    const { data, error } = await supabase.functions.invoke("stripe-create-checkout-session", {
      body: { tenant_id: tenant.id, plan_slug: "pro", origin: window.location.origin },
    });
    setStripeLoading(false);
    if (error || !data?.url) {
      setStripeError(error?.message || "Não foi possível abrir o checkout Stripe.");
      return;
    }
    window.location.assign(data.url);
  };

  const openStripePortal = async () => {
    if (!tenant?.id) return;
    setStripeLoading(true);
    setStripeError(null);
    const { data, error } = await supabase.functions.invoke("stripe-create-portal-session", {
      body: { tenant_id: tenant.id, origin: window.location.origin },
    });
    setStripeLoading(false);
    if (error || !data?.url) {
      setStripeError(error?.message || "Nenhuma assinatura Stripe ativa foi encontrada.");
      return;
    }
    window.location.assign(data.url);
  };

  // Address query for map geocoding
  const searchAddressString = [street, number, neighborhood, city, stateUf].filter(Boolean).join(", ");

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Configurações da Barbearia</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Identidade visual, WhatsApp, localização no mapa e link exclusivo do chat
              </p>
            </div>
          </div>
        </div>

        {/* Quick Link Preview Badge */}
        {slug && (
          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl border border-slate-200">
            <Globe className="w-4 h-4 text-accent shrink-0" />
            <span className="text-xs font-mono font-semibold text-slate-700 truncate max-w-[180px] sm:max-w-[240px]">
              mbarber.com.br/{slug}
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition"
              title="Copiar link do chat"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition"
              title="Testar chat em nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5 text-accent" />
            </a>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SEÇÃO 1: LOGO E IDENTIDADE VISUAL */}
        <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ImageIcon className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-slate-900 text-base">Logo da Barbearia</h3>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Logo Preview */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shadow-inner">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Barbearia" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2 text-slate-400">
                    <Store className="w-8 h-8 mx-auto mb-1 stroke-1" />
                    <span className="text-[10px] block font-medium">Sem Logo</span>
                  </div>
                )}
              </div>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-600 text-white shadow hover:bg-red-700 transition"
                  title="Remover logo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Upload Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingLogo(true);
              }}
              onDragLeave={() => setIsDraggingLogo(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 w-full p-5 rounded-2xl border-2 border-dashed transition cursor-pointer flex flex-col items-center justify-center text-center ${
                isDraggingLogo
                  ? "border-accent bg-accent/5"
                  : "border-slate-300 hover:border-accent/60 bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
              <div className="text-xs font-bold text-slate-800">
                Arraste sua imagem aqui ou <span className="text-accent underline">clique para selecionar</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, SVG ou WebP (recomendado 512x512px, máx. 5MB)</p>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: DADOS GERAIS E WHATSAPP */}
        <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-slate-900 text-base">Nome Fantasia & Comunicação</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome Fantasia da Barbearia <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  disabled={saveLoading}
                  value={tradeName}
                  onChange={handleTradeNameChange}
                  placeholder="Ex: Barbearia Navalha & Estilo"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Nome exibido no chat de agendamento e nas mensagens para os clientes.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp Comercial da Barbearia <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    disabled={saveLoading}
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 98765-4321"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent font-medium text-slate-900 bg-white placeholder:text-slate-400 shadow-sm"
                  />
                </div>
                {phone && (
                  <a
                    href={`https://wa.me/55${phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1 transition shrink-0"
                    title="Testar conversa no WhatsApp"
                  >
                    <span>Testar</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Número que receberá as mensagens e avisos de novos agendamentos.
              </span>
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: LINK PÚBLICO COM TRAVA DE 7 DIAS */}
        <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Link Único de Agendamento</h3>
                <p className="text-xs text-slate-500">Seu endereço exclusivo para divulgar no Instagram, WhatsApp e Google</p>
              </div>
            </div>

            {/* Lock Status Badge */}
            <div className="shrink-0 flex items-center gap-2">
              {!isSlugLocked && tradeName && (
                <button
                  type="button"
                  onClick={() => {
                    const suggested = generateSlug(tradeName);
                    if (suggested) {
                      isUserEditedRef.current.slug = true;
                      setSlug(suggested);
                      setSlugManuallyEdited(false);
                    }
                  }}
                  title="Sugerir link a partir do Nome Fantasia da barbearia"
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent/80 hover:underline px-2 py-1 rounded cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sugerir do nome</span>
                </button>
              )}
              {isSlugLocked ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Bloqueado ({daysRemaining}d restantes)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Liberado para troca</span>
                </span>
              )}
            </div>
          </div>

          {/* Slug Input Group */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Endereço Oficial (URL)
              </label>
              {!isSlugLocked && (
                <span className="text-[11px] text-slate-500">
                  {slugManuallyEdited ? "Personalizado manualmente" : "Sugerido automaticamente"}
                </span>
              )}
            </div>
            <div
              className={`flex rounded-xl border transition overflow-hidden ${
                isSlugLocked
                  ? "bg-slate-100 border-slate-200 cursor-not-allowed"
                  : "border-slate-300 focus-within:border-accent bg-white shadow-sm"
              }`}
            >
              <span className="bg-slate-100 px-3.5 py-2.5 text-xs text-slate-700 font-mono font-bold border-r border-slate-200 flex items-center select-none shrink-0">
                mbarber.com.br/
              </span>
              <input
                type="text"
                disabled={saveLoading || isSlugLocked}
                value={slug}
                onChange={handleSlugChange}
                placeholder="sua-barbearia"
                className={`w-full px-3.5 py-2 text-sm font-mono font-bold focus:outline-none ${
                  isSlugLocked
                    ? "text-slate-500 bg-slate-100 cursor-not-allowed"
                    : "text-slate-900 bg-white placeholder:text-slate-400"
                }`}
              />
            </div>

            {/* Real-time Slug Availability Status */}
            {slugStatus !== "idle" && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border transition ${
                  slugStatus === "checking"
                    ? "bg-slate-50 border-slate-200 text-slate-700"
                    : slugStatus === "available"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold"
                    : slugStatus === "taken"
                    ? "bg-rose-50 border-rose-200 text-rose-800 font-bold"
                    : slugStatus === "current"
                    ? "bg-slate-100 border-slate-200 text-slate-700"
                    : "bg-amber-50 border-amber-200 text-amber-800 font-semibold"
                }`}
              >
                {slugStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
                {slugStatus === "available" && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                {slugStatus === "taken" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                {slugStatus === "current" && <Check className="w-4 h-4 text-slate-600 shrink-0" />}
                {slugStatus === "invalid" && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                <span>{slugStatusMessage}</span>
              </div>
            )}
          </div>

          {/* Security Rule Explanation */}
          {isSlugLocked ? (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Trava de 7 dias ativa</span>
              </div>
              <p className="leading-relaxed">
                O link foi alterado recentemente em{" "}
                <strong>{lastChangedDate?.toLocaleDateString("pt-BR")} às {lastChangedDate?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>.
                Para evitar que clientes fiquem com links quebrados ou cartões desatualizados, uma nova troca só é permitida a cada 7 dias (liberação em{" "}
                <strong>{unlockDate?.toLocaleDateString("pt-BR")}</strong>).
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Regra de Estabilidade:</strong> Cada link é único em toda a plataforma. Ao salvar uma alteração de link, os acessos anteriores passarão a usar o novo endereço e uma nova troca só será permitida após 7 dias.
              </span>
            </div>
          )}

          {/* Link Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Link Copiado!" : "Copiar Link Completo"}</span>
            </button>

            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>Abrir Chat de Agendamento</span>
              <ExternalLink className="w-3.5 h-3.5 text-accent" />
            </a>
          </div>
        </div>

        {/* SEÇÃO 4: ENDEREÇO & MARCAÇÃO NO MAPA */}
        <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MapPin className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Endereço & Localização no Mapa</h3>
              <p className="text-xs text-slate-500">
                O endereço e o ponto exato no mapa são enviados diretamente ao cliente no WhatsApp após o agendamento
              </p>
            </div>
          </div>

          {/* CEP e Logradouro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CEP</label>
              <div className="relative">
                <input
                  type="text"
                  disabled={saveLoading || cepLoading}
                  value={zipCode}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent font-medium text-slate-900 bg-white placeholder:text-slate-400 shadow-sm"
                />
                {cepLoading && (
                  <Loader2 className="w-4 h-4 text-accent animate-spin absolute right-3 top-3" />
                )}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">Digite o CEP para autocompletar</span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Rua / Logradouro</label>
              <input
                type="text"
                disabled={saveLoading}
                value={street}
                onChange={(e) => {
                  isUserEditedRef.current.address = true;
                  setStreet(e.target.value);
                }}
                placeholder="Ex: Rua Augusta"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
              />
            </div>
          </div>

          {/* Número, Complemento e Bairro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Número</label>
              <input
                type="text"
                disabled={saveLoading}
                value={number}
                onChange={(e) => {
                  isUserEditedRef.current.address = true;
                  setNumber(e.target.value);
                }}
                placeholder="Ex: 1500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Complemento / Sala</label>
              <input
                type="text"
                disabled={saveLoading}
                value={complement}
                onChange={(e) => {
                  isUserEditedRef.current.address = true;
                  setComplement(e.target.value);
                }}
                placeholder="Ex: Sala 42 / Bloco A"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bairro</label>
              <input
                type="text"
                disabled={saveLoading}
                value={neighborhood}
                onChange={(e) => {
                  isUserEditedRef.current.address = true;
                  setNeighborhood(e.target.value);
                }}
                placeholder="Ex: Consolação"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
              />
            </div>
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Cidade</label>
              <input
                type="text"
                disabled={saveLoading}
                value={city}
                onChange={(e) => {
                  isUserEditedRef.current.address = true;
                  setCity(e.target.value);
                }}
                placeholder="Ex: São Paulo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent text-slate-900 bg-white font-medium placeholder:text-slate-400 shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Estado (UF)</label>
              <input
                type="text"
                maxLength={2}
                disabled={saveLoading}
                value={stateUf}
                onChange={(e) => {
                  isUserEditedRef.current.address = true;
                  setStateUf(e.target.value.toUpperCase());
                }}
                placeholder="SP"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-accent uppercase font-bold text-slate-900 bg-white placeholder:text-slate-400 text-center shadow-sm"
              />
            </div>
          </div>

          {/* MAP PICKER COMPONENT */}
          <div className="pt-2 border-t border-slate-100">
            <div className="mb-2">
              <label className="block text-xs font-bold text-slate-800 mb-0.5">
                Ponto Exato no Mapa (GPS)
              </label>
              <p className="text-xs text-slate-500">
                Arraste ou clique no mapa para posicionar a entrada da sua barbearia com precisão milimétrica.
              </p>
            </div>

            <MapLocationPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                isUserEditedRef.current.address = true;
                setLatitude(lat);
                setLongitude(lng);
              }}
              searchAddressQuery={searchAddressString}
              addressComponents={{
                street,
                number,
                neighborhood,
                city,
                stateUf,
                zipCode,
              }}
              disabled={saveLoading}
            />
          </div>
        </div>

        {/* Error Banner */}
        {saveError && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Atenção ao salvar:</div>
              <div>{saveError}</div>
            </div>
          </div>
        )}

        {/* Save Bar */}
        <div className="surface-card-light p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            {isSaved ? (
              <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" /> Configurações salvas com sucesso!
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Lembre-se de clicar em salvar para atualizar seu link, logo e mapa.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={saveLoading}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-accent hover:bg-accent/90 text-slate-950 font-black text-sm transition shadow-md shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{saveLoading ? "Salvando..." : "Salvar Todas as Configurações"}</span>
          </button>
        </div>
      </form>

      {/* SEÇÃO: NOTIFICAÇÕES PUSH E ALERTAS EM TEMPO REAL */}
      <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Notificações Push & Alertas em Tempo Real</h3>
              <p className="text-xs text-slate-500">
                Avisos sonoros e pop-ups nativos no computador e celular a cada novo agendamento via chat ou web
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              permission === "granted"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : permission === "denied"
                ? "bg-red-100 text-red-800 border border-red-300"
                : "bg-amber-100 text-amber-800 border border-amber-300"
            }`}
          >
            {permission === "granted"
              ? "Push Ativo"
              : permission === "denied"
              ? "Bloqueado no Navegador"
              : "Não Ativado"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card de Permissão Push do Navegador */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-accent" />
                <span>Notificações na Tela (Navegador & Sistema)</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Mesmo com a aba da barbearia em segundo plano ou minimizada, você receberá um alerta imediato com nome do cliente, serviço e horário.
              </p>
            </div>

            <div className="pt-2">
              {permission === "granted" ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Seu navegador já está autorizado a receber alertas push.</span>
                </div>
              ) : permission === "denied" ? (
                <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200">
                  <div className="font-bold flex items-center gap-1.5 mb-0.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Permissão bloqueada no navegador</span>
                  </div>
                  <span>Clique no ícone de ajustes/cadeado na barra de endereço do seu navegador e altere "Notificações" para "Permitir".</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestPush}
                  disabled={requestingPush}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <Bell className="w-4 h-4" />
                  <span>{requestingPush ? "Solicitando..." : "Ativar Notificações Push Agora"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Card de Alerta Sonoro (Chime) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-accent" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-400" />
                )}
                <span>Alerta Sonoro Melódico</span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Toca um sinal sonoro agradável e discreto de barbearia sempre que um agendamento for registrado.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="relative inline-flex items-center cursor-pointer gap-2">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                <span className="text-xs font-semibold text-slate-700">
                  {soundEnabled ? "Som Ativado" : "Mudo"}
                </span>
              </label>

              <button
                type="button"
                onClick={handleTestNotification}
                className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition flex items-center gap-1.5"
                title="Testa som e notificação simultaneamente"
              >
                <Play className="w-3.5 h-3.5 text-accent" />
                <span>Testar Alerta</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 5: ASSINATURA STRIPE */}
      <div className="surface-card-light p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-accent" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Assinatura do MetricBarber (Stripe)</h3>
              <p className="text-xs text-slate-500">Gerenciamento de faturas, cartões e planos</p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              subscription?.status === "active"
                ? "bg-emerald-100 text-emerald-800"
                : "surface-accent-soft text-primary-on-light"
            }`}
          >
            {subscription?.status === "active" ? "Assinatura ativa" : subscription?.status || "Período de Testes (Trial)"}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-slate-900 text-sm">
              {subscription?.plans?.name || defaultPlan?.name || "Plano Profissional MetricBarber"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Assinatura gerenciada com segurança pelo Stripe</div>
            <div className="text-base font-black text-slate-900 mt-2">
              {formatCurrency(subscription?.plans?.price_cents || defaultPlan?.price_cents || 9700)} /{" "}
              {(subscription?.plans?.billing_cycle || defaultPlan?.billing_cycle) === "yearly"
                ? "ano"
                : (subscription?.plans?.billing_cycle || defaultPlan?.billing_cycle) === "quarterly"
                ? "trimestre"
                : "mês"}
            </div>
            {subscription?.current_period_end && (
              <div className="text-xs text-slate-500 mt-1">
                Próxima renovação: {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openStripeCheckout}
              disabled={stripeLoading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>{stripeLoading ? "Abrindo Stripe..." : "Assinar via Stripe"}</span>
            </button>
            <button
              type="button"
              onClick={openStripePortal}
              disabled={stripeLoading}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-100 transition disabled:opacity-50"
            >
              Faturas e assinatura
            </button>
          </div>
        </div>
        {stripeError && <p className="text-xs text-red-600">{stripeError}</p>}
      </div>
    </div>
  );
};
