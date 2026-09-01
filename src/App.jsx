import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Minus, Search, AlertTriangle, Package, Trash2, Pencil, X, History,
  MapPin, Loader2, ChevronDown, ChevronUp, User, Camera, ImageOff, Download,
} from "lucide-react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, getDocs, writeBatch, serverTimestamp,
} from "firebase/firestore";

const COLORS = {
  dark: "#453B3C",
  darkSoft: "#59494A",
  panel: "#FFFFFF",
  bg: "#F2EFEE",
  border: "#E1D9D7",
  orange: "#E97307",
  orangeDark: "#C86206",
  green: "#2E8B57",
  greenBg: "#E7F3EC",
  red: "#C0392B",
  redBg: "#FBEAE8",
  textMuted: "#8A7A78",
};

const USUARIOS_PADRAO = [
  { nome: "Walter Kohut", senha: "053812" },
  { nome: "Victor Assunção", senha: "123456" },
  { nome: "Juan Pablo", senha: "123456" },
  { nome: "Eike Galdino", senha: "123456" },
  { nome: "Felipe Françoso", senha: "123456" },
];

const SESSION_KEY = "tecnopemt-estoque-sessao";

function senhasIguais(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

function statusOf(c) {
  if (c.qtd <= c.min) return "critico";
  if (c.qtd <= c.min * 1.25) return "atencao";
  return "ok";
}

const STATUS_META = {
  critico: { label: "Abaixo do mínimo", color: COLORS.red, bg: COLORS.redBg },
  atencao: { label: "Próximo do mínimo", color: COLORS.orangeDark, bg: "#FBEBDB" },
  ok: { label: "Estoque ok", color: COLORS.green, bg: COLORS.greenBg },
};

function currency(v) {
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function compressImage(file, maxWidth = 500, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [components, setComponents] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCritico, setFilterCritico] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [moveModal, setMoveModal] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [meuNome, setMeuNome] = useState("");
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // sincronização em tempo real dos itens
  useEffect(() => {
    const q = query(collection(db, "components"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComponents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // sincronização em tempo real das movimentações
  useEffect(() => {
    const q = query(collection(db, "movements"), orderBy("data", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMovements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // usuários: carrega e, se a coleção estiver vazia, cria os padrão
  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "usuarios"));
      if (snap.empty) {
        const batch = writeBatch(db);
        USUARIOS_PADRAO.forEach((u) => {
          const ref = doc(collection(db, "usuarios"));
          batch.set(ref, { nome: u.nome, senha: u.senha });
        });
        await batch.commit();
        setUsuarios(USUARIOS_PADRAO.map((u) => ({ ...u })));
      } else {
        setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    })();
  }, []);

  // sessão local (por aparelho)
  useEffect(() => {
    const salvo = localStorage.getItem(SESSION_KEY);
    if (salvo) setMeuNome(salvo);
  }, []);

  async function fazerLogin(nome, senha) {
    const user = usuarios.find((u) => u.nome === nome);
    if (!user) return { ok: false, erro: "Usuário não encontrado." };
    if (!senhasIguais(senha, user.senha)) return { ok: false, erro: "Senha incorreta." };
    setMeuNome(nome);
    localStorage.setItem(SESSION_KEY, nome);
    return { ok: true };
  }

  async function trocarSenha(nome, senhaAtual, novaSenha) {
    const user = usuarios.find((u) => u.nome === nome);
    if (!user) return { ok: false, erro: "Usuário não encontrado." };
    if (!senhasIguais(senhaAtual, user.senha)) return { ok: false, erro: "Senha atual incorreta." };
    try {
      await updateDoc(doc(db, "usuarios", user.id), { senha: String(novaSenha).trim() });
      setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, senha: novaSenha } : u)));
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: "Não consegui salvar a nova senha. Tente novamente." };
    }
  }

  async function resetarSenhaPadrao(nome) {
    const padrao = USUARIOS_PADRAO.find((u) => u.nome === nome);
    const user = usuarios.find((u) => u.nome === nome);
    if (!padrao || !user) return { ok: false, erro: "Usuário não encontrado." };
    try {
      await updateDoc(doc(db, "usuarios", user.id), { senha: padrao.senha });
      setUsuarios((prev) => prev.map((u) => (u.id === user.id ? { ...u, senha: padrao.senha } : u)));
      return { ok: true };
    } catch (e) {
      return { ok: false, erro: "Não consegui redefinir. Tente novamente." };
    }
  }

  function fazerLogout() {
    setMeuNome("");
    localStorage.removeItem(SESSION_KEY);
  }

  function openNew() {
    setEditingId(null);
    setFormOpen(true);
  }
  function openEdit(id) {
    setEditingId(id);
    setFormOpen(true);
  }

  async function saveComponent(data) {
    if (editingId) {
      await updateDoc(doc(db, "components", editingId), data);
    } else {
      await addDoc(collection(db, "components"), { ...data, createdAt: serverTimestamp() });
    }
    setFormOpen(false);
    setEditingId(null);
  }

  async function deleteComponent(id) {
    await deleteDoc(doc(db, "components", id));
    const relacionados = movements.filter((m) => m.componentId === id);
    await Promise.all(relacionados.map((m) => deleteDoc(doc(db, "movements", m.id))));
  }

  function requestMove(componentId, tipo) {
    if (!meuNome) {
      setLoginModalOpen(true);
      return;
    }
    setMoveModal({ componentId, tipo });
  }

  async function registerMovement(componentId, tipo, quantidade, obs) {
    const comp = components.find((c) => c.id === componentId);
    if (!comp) return;
    const delta = tipo === "entrada" ? quantidade : -quantidade;
    const novaQtd = Math.max(0, (comp.qtd || 0) + delta);
    await updateDoc(doc(db, "components", componentId), { qtd: novaQtd });
    await addDoc(collection(db, "movements"), {
      componentId,
      tipo,
      quantidade,
      data: new Date().toISOString(),
      obs: obs || "",
      responsavel: meuNome || "—",
    });
    setMoveModal(null);
  }

  const filtered = useMemo(() => {
    let list = components;
    if (filterCritico) list = list.filter((c) => statusOf(c) === "critico");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.nome?.toLowerCase().includes(q) ||
          c.localizacao?.toLowerCase().includes(q) ||
          c.aplicacao?.toLowerCase().includes(q) ||
          c.descricao?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [components, search, filterCritico]);

  const criticoCount = components.filter((c) => statusOf(c) === "critico").length;

  if (!meuNome) {
    return (
      <div style={{ background: COLORS.dark, minHeight: "100vh" }}>
        <LoginModal
          usuarios={usuarios}
          meuNome={meuNome}
          onCancel={() => {}}
          onLogin={fazerLogin}
          onTrocarSenha={trocarSenha}
          onResetSenha={resetarSenhaPadrao}
          onLogout={fazerLogout}
          mandatory
        />
      </div>
    );
  }

  if (formOpen) {
    return (
      <ComponentForm
        initial={editingId ? components.find((c) => c.id === editingId) : null}
        onCancel={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        onSave={saveComponent}
      />
    );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: COLORS.dark }} className="px-4 py-4 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div style={{ background: COLORS.orange, width: 5, height: 30 }} className="rounded-sm" />
              <div className="leading-none">
                <div className="text-white text-xl font-semibold tracking-wide">
                  TECNO<span style={{ color: COLORS.orange }}>PEMT</span>
                </div>
                <div className="text-[9px] tracking-widest" style={{ color: "#C9BAB8" }}>
                  CONTROLE DE ESTOQUE
                </div>
              </div>
            </div>
            <button
              onClick={() => setLoginModalOpen(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded"
              style={{ background: COLORS.darkSoft, color: "#EDE3E2" }}
            >
              <User size={13} />
              {meuNome}
            </button>
          </div>

          <div className="flex gap-3 mt-4 flex-wrap">
            <div style={{ background: COLORS.darkSoft }} className="rounded px-4 py-2 flex-1 min-w-[120px]">
              <div className="text-white text-xl font-mono">{components.length}</div>
              <div className="text-xs" style={{ color: "#C9BAB8" }}>itens cadastrados</div>
            </div>
            <button
              onClick={() => setFilterCritico((v) => !v)}
              style={{
                background: filterCritico ? COLORS.red : COLORS.darkSoft,
                border: criticoCount > 0 ? `1px solid ${COLORS.red}` : "1px solid transparent",
              }}
              className="rounded px-4 py-2 flex-1 min-w-[120px] text-left transition-colors"
            >
              <div className="text-white text-xl font-mono flex items-center gap-1.5">
                {criticoCount > 0 && <AlertTriangle size={16} color={COLORS.orange} />}
                {criticoCount}
              </div>
              <div className="text-xs" style={{ color: "#C9BAB8" }}>abaixo do mínimo</div>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-5">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} style={{ position: "absolute", left: 10, top: 11, color: COLORS.textMuted }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nome, local ou aplicação..."
              className="w-full rounded pl-8 pr-3 py-2 text-sm outline-none"
              style={{ border: `1px solid ${COLORS.border}`, background: COLORS.panel }}
            />
          </div>
          <button
            onClick={openNew}
            style={{ background: COLORS.orange }}
            className="rounded px-4 py-2 text-white text-sm font-medium flex items-center gap-1.5 hover:opacity-90 shrink-0"
          >
            <Plus size={16} /> Novo item
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16" style={{ color: COLORS.textMuted }}>
            <Loader2 className="animate-spin mr-2" size={18} /> Carregando estoque...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="text-center py-16 rounded"
            style={{ background: COLORS.panel, border: `1px dashed ${COLORS.border}`, color: COLORS.textMuted }}
          >
            <Package size={28} className="mx-auto mb-2" style={{ color: COLORS.border }} />
            {components.length === 0
              ? 'Nenhum componente cadastrado ainda. Toque em "Novo item" para começar.'
              : "Nenhum item encontrado com esse filtro."}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c) => (
              <ComponentCard
                key={c.id}
                comp={c}
                expanded={expanded === c.id}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                onEdit={() => openEdit(c.id)}
                onDelete={() => deleteComponent(c.id)}
                onMove={(tipo) => requestMove(c.id, tipo)}
                movimentos={movements.filter((m) => m.componentId === c.id)}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: COLORS.textMuted }}>
          Painel compartilhado em tempo real — alterações feitas aqui são vistas por toda a equipe Tecnopemt.
        </p>
      </div>

      {moveModal && (
        <MoveModal
          tipo={moveModal.tipo}
          comp={components.find((c) => c.id === moveModal.componentId)}
          onCancel={() => setMoveModal(null)}
          onConfirm={(qtd, obs) => registerMovement(moveModal.componentId, moveModal.tipo, qtd, obs)}
        />
      )}

      {loginModalOpen && (
        <LoginModal
          usuarios={usuarios}
          meuNome={meuNome}
          onCancel={() => setLoginModalOpen(false)}
          onLogin={fazerLogin}
          onTrocarSenha={trocarSenha}
          onResetSenha={resetarSenhaPadrao}
          onLogout={() => {
            fazerLogout();
            setLoginModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ComponentCard({ comp, expanded, onToggle, onEdit, onDelete, onMove, movimentos }) {
  const status = statusOf(comp);
  const meta = STATUS_META[status];
  const pct = comp.max > comp.min ? Math.min(1, (comp.qtd - comp.min) / (comp.max - comp.min)) : comp.qtd > 0 ? 1 : 0;
  const ultimaSaida = movimentos.find((m) => m.tipo === "saida");
  const ultimaEntrada = movimentos.find((m) => m.tipo === "entrada");

  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }} className="rounded overflow-hidden">
      <div className="flex">
        <div style={{ background: meta.color, width: 5 }} />
        <div className="flex-1 p-3.5">
          <div className="flex justify-between items-start gap-3">
            <div className="flex gap-3 min-w-0">
              {comp.foto ? (
                <img
                  src={comp.foto}
                  alt={comp.nome}
                  className="rounded shrink-0 object-cover"
                  style={{ width: 52, height: 52, border: `1px solid ${COLORS.border}` }}
                />
              ) : (
                <div
                  className="rounded shrink-0 flex items-center justify-center"
                  style={{ width: 52, height: 52, background: COLORS.bg, color: COLORS.border }}
                >
                  <ImageOff size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: COLORS.bg, color: COLORS.dark }}>
                    <MapPin size={10} className="inline -mt-0.5 mr-0.5" />
                    {comp.localizacao || "sem local"}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
                <h3 className="text-lg mt-1 truncate font-semibold" style={{ color: COLORS.dark }}>
                  {comp.nome}
                </h3>
                <p className="text-sm truncate" style={{ color: COLORS.textMuted }}>
                  {comp.aplicacao}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-mono" style={{ color: meta.color }}>{comp.qtd}</div>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>min {comp.min} / máx {comp.max}</div>
            </div>
          </div>

          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: COLORS.bg }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: meta.color, transition: "width 0.3s" }} />
          </div>

          {(ultimaEntrada || ultimaSaida) && (
            <div className="flex gap-4 flex-wrap mt-2 text-xs" style={{ color: COLORS.textMuted }}>
              {ultimaEntrada && (
                <span>
                  <span style={{ color: COLORS.green }} className="font-medium">↑ última entrada:</span> {ultimaEntrada.quantidade} un. — {ultimaEntrada.responsavel}
                </span>
              )}
              {ultimaSaida && (
                <span>
                  <span style={{ color: COLORS.red }} className="font-medium">↓ última saída:</span> {ultimaSaida.quantidade} un. — {ultimaSaida.responsavel}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={() => onMove("entrada")} style={{ background: COLORS.greenBg, color: COLORS.green }} className="text-xs font-medium px-2.5 py-1.5 rounded flex items-center gap-1">
              <Plus size={13} /> Entrada
            </button>
            <button onClick={() => onMove("saida")} style={{ background: COLORS.redBg, color: COLORS.red }} className="text-xs font-medium px-2.5 py-1.5 rounded flex items-center gap-1">
              <Minus size={13} /> Saída
            </button>
            <button onClick={onToggle} style={{ color: COLORS.dark }} className="text-xs font-medium px-2.5 py-1.5 rounded flex items-center gap-1 ml-auto">
              <History size={13} /> Histórico
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button onClick={onEdit} style={{ color: COLORS.textMuted }} className="p-1.5 rounded"><Pencil size={15} /></button>
            <button onClick={onDelete} style={{ color: COLORS.textMuted }} className="p-1.5 rounded"><Trash2 size={15} /></button>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 text-sm" style={{ borderTop: `1px solid ${COLORS.border}` }}>
              {comp.descricao && (
                <p className="mb-2" style={{ color: COLORS.dark }}><span className="font-medium">Descrição: </span>{comp.descricao}</p>
              )}
              <div className="flex gap-4 flex-wrap mb-2" style={{ color: COLORS.textMuted }}>
                <span>
                  <span className="font-medium" style={{ color: COLORS.dark }}>Última compra: </span>
                  {currency(comp.precoUltimaCompra)} {comp.localCompra && `— ${comp.localCompra}`}
                </span>
              </div>
              {comp.observacao && <p className="mb-2 italic" style={{ color: COLORS.textMuted }}>{comp.observacao}</p>}

              <div className="mt-2">
                <span className="font-medium text-xs" style={{ color: COLORS.dark }}>MOVIMENTAÇÕES</span>
                {movimentos.length === 0 ? (
                  <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>Nenhuma movimentação registrada.</p>
                ) : (
                  <div className="mt-1 flex flex-col gap-1">
                    {movimentos.slice(0, 8).map((m) => (
                      <div key={m.id} className="text-xs flex gap-2 items-center flex-wrap">
                        <span className="font-mono px-1 rounded" style={{ color: m.tipo === "entrada" ? COLORS.green : COLORS.red, background: m.tipo === "entrada" ? COLORS.greenBg : COLORS.redBg }}>
                          {m.tipo === "entrada" ? "+" : "-"}{m.quantidade}
                        </span>
                        <span style={{ color: COLORS.textMuted }}>{new Date(m.data).toLocaleDateString("pt-BR")}</span>
                        {m.responsavel && <span style={{ color: COLORS.dark }} className="font-medium">{m.responsavel}</span>}
                        {m.obs && <span style={{ color: COLORS.textMuted }}>· {m.obs}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComponentForm({ initial, onCancel, onSave }) {
  const [f, setF] = useState({
    localizacao: initial?.localizacao || "",
    nome: initial?.nome || "",
    aplicacao: initial?.aplicacao || "",
    descricao: initial?.descricao || "",
    qtd: initial?.qtd ?? 0,
    min: initial?.min ?? 0,
    max: initial?.max ?? 0,
    precoUltimaCompra: initial?.precoUltimaCompra ?? "",
    localCompra: initial?.localCompra || "",
    observacao: initial?.observacao || "",
    foto: initial?.foto || "",
  });
  const fileInputRef = useRef(null);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState("");
  const [salvando, setSalvando] = useState(false);

  function set(k, v) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoError("");
    setFotoLoading(true);
    try {
      const dataUrl = await compressImage(file);
      set("foto", dataUrl);
    } catch (err) {
      setFotoError("Não foi possível processar a foto. Tente outra imagem.");
    } finally {
      setFotoLoading(false);
    }
  }

  async function submit() {
    if (!f.nome.trim()) return;
    setSalvando(true);
    try {
      await onSave({
        ...f,
        qtd: Number(f.qtd) || 0,
        min: Number(f.min) || 0,
        max: Number(f.max) || 0,
        precoUltimaCompra: f.precoUltimaCompra === "" ? null : Number(f.precoUltimaCompra),
      });
    } finally {
      setSalvando(false);
    }
  }

  const field = "w-full rounded px-3 py-2 text-sm outline-none";
  const fieldStyle = { border: `1px solid ${COLORS.border}` };
  const label = "text-xs font-medium block mb-1";
  const labelStyle = { color: COLORS.dark };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh" }}>
      <div style={{ background: COLORS.panel, maxWidth: 600, margin: "0 auto" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <h2 className="text-lg font-semibold" style={{ color: COLORS.dark }}>{initial ? "Editar item" : "Novo item"}</h2>
          <button type="button" onClick={onCancel}><X size={20} color={COLORS.textMuted} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className={label} style={labelStyle}>Foto do item</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} disabled={fotoLoading} />
            <div className="flex flex-col items-center gap-2">
              {f.foto ? (
                <img src={f.foto} alt="Prévia" className="rounded object-cover w-full" style={{ maxWidth: 200, aspectRatio: "1 / 1", border: `1px solid ${COLORS.border}` }} />
              ) : (
                <div className="rounded flex items-center justify-center w-full" style={{ maxWidth: 200, aspectRatio: "1 / 1", background: COLORS.bg, color: COLORS.border }}>
                  <Camera size={28} />
                </div>
              )}
              <div className="flex items-center gap-3 flex-wrap justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  disabled={fotoLoading}
                  className="text-xs font-medium px-3 py-2 rounded cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: COLORS.orange, color: "white" }}
                >
                  {fotoLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  {f.foto ? "Trocar foto" : "Adicionar foto"}
                </button>
                {f.foto && !fotoLoading && (
                  <button type="button" onClick={() => set("foto", "")} className="text-xs" style={{ color: COLORS.red }}>Remover</button>
                )}
              </div>
            </div>
            {fotoError && <p className="text-xs mt-1 text-center" style={{ color: COLORS.red }}>{fotoError}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} style={labelStyle}>Localização</label>
              <input className={field} style={fieldStyle} value={f.localizacao} onChange={(e) => set("localizacao", e.target.value)} placeholder="Gaveta A3" />
            </div>
            <div>
              <label className={label} style={labelStyle}>Nome do componente *</label>
              <input required className={field} style={fieldStyle} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="NTC 120D-20" />
            </div>
          </div>

          <div>
            <label className={label} style={labelStyle}>Aplicação</label>
            <input className={field} style={fieldStyle} value={f.aplicacao} onChange={(e) => set("aplicacao", e.target.value)} placeholder="Fonte Curtis 1244" />
          </div>

          <div>
            <label className={label} style={labelStyle}>Descrição</label>
            <textarea className={field} style={fieldStyle} rows={2} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Termistor NTC, disco 20mm, 120Ω a 25°C" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={label} style={labelStyle}>Qtd. atual</label>
              <input type="number" className={`${field} font-mono`} style={fieldStyle} value={f.qtd} onChange={(e) => set("qtd", e.target.value)} />
            </div>
            <div>
              <label className={label} style={labelStyle}>Mínimo</label>
              <input type="number" className={`${field} font-mono`} style={fieldStyle} value={f.min} onChange={(e) => set("min", e.target.value)} />
            </div>
            <div>
              <label className={label} style={labelStyle}>Máximo</label>
              <input type="number" className={`${field} font-mono`} style={fieldStyle} value={f.max} onChange={(e) => set("max", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} style={labelStyle}>Preço última compra (R$)</label>
              <input type="number" step="0.01" className={`${field} font-mono`} style={fieldStyle} value={f.precoUltimaCompra} onChange={(e) => set("precoUltimaCompra", e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className={label} style={labelStyle}>Local da compra</label>
              <input className={field} style={fieldStyle} value={f.localCompra} onChange={(e) => set("localCompra", e.target.value)} placeholder="Mercado Livre / fornecedor" />
            </div>
          </div>

          <div>
            <label className={label} style={labelStyle}>Observação</label>
            <textarea className={field} style={fieldStyle} rows={2} value={f.observacao} onChange={(e) => set("observacao", e.target.value)} placeholder="Notas adicionais" />
          </div>
        </div>

        <div className="flex gap-2 p-4 pt-0">
          <button type="button" onClick={onCancel} className="flex-1 rounded py-2.5 text-sm font-medium" style={{ background: COLORS.bg, color: COLORS.dark }}>Cancelar</button>
          <button type="button" onClick={submit} disabled={salvando} className="flex-1 rounded py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: COLORS.orange }}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveModal({ tipo, comp, onCancel, onConfirm }) {
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const isEntrada = tipo === "entrada";
  if (!comp) return null;

  async function submit() {
    const n = Number(qtd);
    if (!n || n <= 0) return;
    setEnviando(true);
    try {
      await onConfirm(n, obs);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(69,59,60,0.55)" }}>
      <div style={{ background: COLORS.panel }} className="w-full max-w-sm rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: isEntrada ? COLORS.green : COLORS.red }}>
            {isEntrada ? "Registrar entrada" : "Registrar saída"}
          </h2>
          <button type="button" onClick={onCancel}><X size={20} color={COLORS.textMuted} /></button>
        </div>
        <p className="text-sm mb-3" style={{ color: COLORS.textMuted }}>
          {comp.nome} — estoque atual: <span className="font-mono">{comp.qtd}</span>
        </p>
        <label className="text-xs font-medium block mb-1" style={{ color: COLORS.dark }}>Quantidade</label>
        <input type="number" min="1" autoFocus value={qtd} onChange={(e) => setQtd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full rounded px-3 py-2 text-sm font-mono mb-3 outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <label className="text-xs font-medium block mb-1" style={{ color: COLORS.dark }}>Observação (opcional)</label>
        <input value={obs} onChange={(e) => setObs(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={isEntrada ? "Ex: compra fornecedor X" : "Ex: usado na OS 123"}
          className="w-full rounded px-3 py-2 text-sm mb-4 outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded py-2.5 text-sm font-medium" style={{ background: COLORS.bg, color: COLORS.dark }}>Cancelar</button>
          <button type="button" onClick={submit} disabled={enviando} className="flex-1 rounded py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ background: isEntrada ? COLORS.green : COLORS.red }}>
            {enviando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoginModal({ usuarios, meuNome, onCancel, onLogin, onTrocarSenha, onResetSenha, onLogout, mandatory }) {
  const [tela, setTela] = useState(meuNome ? "perfil" : "lista");
  const [selecionado, setSelecionado] = useState(null);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [resetando, setResetando] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  function escolher(nome) {
    setSelecionado(nome);
    setSenha("");
    setErro("");
    setAviso("");
    setTela("senha");
  }

  async function submitSenha() {
    setErro("");
    setCarregando(true);
    try {
      const res = await onLogin(selecionado, senha);
      if (!res.ok) { setErro(res.erro); return; }
      onCancel();
    } finally {
      setCarregando(false);
    }
  }

  async function handleResetSenha() {
    setResetando(true);
    setErro("");
    const res = await onResetSenha(selecionado);
    setResetando(false);
    if (!res.ok) { setErro(res.erro); return; }
    setSenha("");
    setAviso("Senha redefinida para o padrão combinado com a equipe. Tente entrar novamente.");
  }

  async function submitTrocarSenha() {
    setErro("");
    if (novaSenha.length < 4) { setErro("A nova senha precisa ter pelo menos 4 dígitos/caracteres."); return; }
    if (novaSenha !== confirmaSenha) { setErro("As senhas não coincidem."); return; }
    setCarregando(true);
    const res = await onTrocarSenha(meuNome, senhaAtual, novaSenha);
    setCarregando(false);
    if (!res.ok) { setErro(res.erro); return; }
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(69,59,60,0.55)" }}>
      <div style={{ background: COLORS.panel }} className="w-full max-w-xs rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" style={{ color: COLORS.dark }}>
            {tela === "perfil" && "Minha conta"}
            {tela === "lista" && "Quem é você?"}
            {tela === "senha" && selecionado}
            {tela === "trocar" && "Alterar senha"}
          </h2>
          <button type="button" onClick={onCancel} style={{ visibility: mandatory ? "hidden" : "visible" }}>
            <X size={20} color={COLORS.textMuted} />
          </button>
        </div>

        {mandatory && tela === "lista" && (
          <p className="text-xs mb-3" style={{ color: COLORS.textMuted }}>Identifique-se com seu usuário e senha para acessar o estoque.</p>
        )}

        {tela === "perfil" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm mb-1" style={{ color: COLORS.textMuted }}>
              Você está identificado como <span className="font-medium" style={{ color: COLORS.dark }}>{meuNome}</span>.
            </p>
            <button onClick={() => setTela("lista")} className="text-sm text-left rounded px-3 py-2" style={{ background: COLORS.bg, color: COLORS.dark }}>Trocar de usuário</button>
            <button onClick={() => { setErro(""); setSenhaAtual(""); setNovaSenha(""); setConfirmaSenha(""); setTela("trocar"); }} className="text-sm text-left rounded px-3 py-2" style={{ background: COLORS.bg, color: COLORS.dark }}>Alterar minha senha</button>
            <button onClick={onLogout} className="text-sm text-left rounded px-3 py-2" style={{ background: COLORS.redBg, color: COLORS.red }}>Sair</button>
          </div>
        )}

        {tela === "lista" && (
          <div className="flex flex-col gap-2">
            {usuarios.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.textMuted }}>Carregando usuários...</p>
            ) : (
              usuarios.map((u) => (
                <button key={u.nome} onClick={() => escolher(u.nome)} className="text-sm text-left rounded px-3 py-2" style={{ background: COLORS.bg, color: COLORS.dark }}>
                  {u.nome}
                </button>
              ))
            )}
          </div>
        )}

        {tela === "senha" && (
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: COLORS.dark }}>Senha</label>
            <input type="password" inputMode="numeric" autoFocus value={senha} onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSenha()}
              className="w-full rounded px-3 py-2 text-sm font-mono mb-2 outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
            {erro && <p className="text-xs mb-2" style={{ color: COLORS.red }}>{erro}</p>}
            {aviso && <p className="text-xs mb-2" style={{ color: COLORS.green }}>{aviso}</p>}
            <button type="button" onClick={submitSenha} disabled={carregando || !senha} className="w-full rounded py-2.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: COLORS.orange }}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
            {erro && (
              <button type="button" onClick={handleResetSenha} disabled={resetando} className="w-full text-xs mt-2 disabled:opacity-50" style={{ color: COLORS.orangeDark }}>
                {resetando ? "Redefinindo..." : "Esqueci a senha — redefinir para o padrão"}
              </button>
            )}
            <button type="button" onClick={() => setTela("lista")} className="w-full text-xs mt-2" style={{ color: COLORS.textMuted }}>Voltar</button>
          </div>
        )}

        {tela === "trocar" && (
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: COLORS.dark }}>Senha atual</label>
            <input type="password" autoFocus value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} className="w-full rounded px-3 py-2 text-sm font-mono mb-2 outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
            <label className="text-xs font-medium block mb-1" style={{ color: COLORS.dark }}>Nova senha</label>
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="w-full rounded px-3 py-2 text-sm font-mono mb-2 outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
            <label className="text-xs font-medium block mb-1" style={{ color: COLORS.dark }}>Confirmar nova senha</label>
            <input type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitTrocarSenha()}
              className="w-full rounded px-3 py-2 text-sm font-mono mb-2 outline-none" style={{ border: `1px solid ${COLORS.border}` }} />
            {erro && <p className="text-xs mb-2" style={{ color: COLORS.red }}>{erro}</p>}
            <button type="button" onClick={submitTrocarSenha} disabled={carregando} className="w-full rounded py-2.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: COLORS.orange }}>
              {carregando ? "Salvando..." : "Salvar nova senha"}
            </button>
            <button type="button" onClick={() => setTela("perfil")} className="w-full text-xs mt-2" style={{ color: COLORS.textMuted }}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
