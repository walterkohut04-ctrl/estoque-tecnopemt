// Chave da API do Google Gemini (gratuita, com cota diária).
// Crie a sua em https://aistudio.google.com/apikey e cole aqui.
//
// IMPORTANTE: como este repositório é público, essa chave fica visível
// pra quem olhar o código. Configure uma restrição de "HTTP referrer" no
// Google AI Studio / Google Cloud Console, limitando o uso dessa chave
// só ao domínio do site (https://walterkohut04-ctrl.github.io/*), para
// que ninguém consiga usá-la fora do seu site mesmo tendo acesso a ela.
const GEMINI_API_KEY = "AQ.Ab8RN6I1mJMPX-NmiC6UdYd_-5xrS4B97INugTFHCAxAHq4jBw";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function chamarGemini(parts) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }] }),
  });
  if (!response.ok) {
    throw new Error(`Gemini respondeu ${response.status}`);
  }
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

export async function reconhecerComponentePorFoto(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!match) throw new Error("Formato de imagem inválido");
  const mimeType = match[1];
  const base64Data = match[2];

  const prompt = `Você é um técnico especialista em componentes eletrônicos. Observe a foto anexada de um componente eletrônico e identifique o que for possível para ajudar no cadastro em um estoque.

Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"nome":"código/nome impresso no componente, lido diretamente da foto","tipo":"tipo do componente em poucas palavras","pinagem":"pinagem/terminais em 1-2 frases curtas, ou 'não aplicável'","funcao":"pra que serve, em 2-3 frases curtas","descricao":"descrição física breve (encapsulamento, formato, cor)","confianca":"alta, media ou baixa"}

Regra importante: só preencha "nome" se conseguir LER um código real impresso na peça na foto. Se não der pra ler nenhum código com clareza, deixe "nome" como string vazia e baseie os outros campos apenas no que for visualmente identificável. Nunca invente um código específico que você não consegue ler claramente na imagem.`;

  return chamarGemini([{ inline_data: { mime_type: mimeType, data: base64Data } }, { text: prompt }]);
}

export async function gerarResumoIA({ nome, aplicacao, descricao }) {
  const prompt = `Você é um técnico especialista em eletrônica industrial. Para o componente eletrônico a seguir, gere um resumo técnico breve e prático.

Código/nome: ${nome}
Aplicação informada pelo usuário: ${aplicacao || "não informada"}
Descrição informada pelo usuário: ${descricao || "não informada"}

Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{"tipo":"tipo do componente em poucas palavras","pinagem":"pinagem/terminais em 1-2 frases curtas, ou 'não aplicável' se não tiver pinos relevantes","funcao":"pra que serve, em 2-3 frases curtas","incerto": true ou false}

Se você não tiver certeza sobre o componente específico, use os campos com sua melhor estimativa e marque "incerto" como true.`;

  return chamarGemini([{ text: prompt }]);
}
