// Base de reconhecimento de componentes eletrônicos por padrão de código.
// Não depende de nenhuma API externa — funciona 100% offline, sem custo.
// Cada entrada tem um "teste" (regex) que verifica o código digitado,
// e o que preencher automaticamente se bater.

const BASE = [
  {
    teste: /^NTC/i,
    tipo: "Termistor NTC",
    descricao: "Termistor de coeficiente negativo (resistência cai com o aumento da temperatura). Usado como limitador de corrente de inrush em fontes/retificadores, ou como sensor de temperatura.",
  },
  {
    teste: /^PTC/i,
    tipo: "Termistor PTC",
    descricao: "Termistor de coeficiente positivo (resistência sobe com o aumento da temperatura). Usado como proteção contra sobrecorrente (rearmável) ou sensor de temperatura.",
  },
  {
    teste: /^(LM)?78\d\d/i,
    tipo: "Regulador de tensão positivo linear",
    descricao: "Regulador de tensão fixo da série 78xx (ex: 7805 = 5V, 7812 = 12V). Converte uma tensão de entrada maior numa saída fixa e regulada.",
  },
  {
    teste: /^(LM)?79\d\d/i,
    tipo: "Regulador de tensão negativo linear",
    descricao: "Regulador de tensão negativa fixa da série 79xx, usado em fontes simétricas.",
  },
  {
    teste: /^LM317/i,
    tipo: "Regulador de tensão ajustável",
    descricao: "Regulador de tensão positivo ajustável (1,25V a 37V), configurado por dois resistores externos.",
  },
  {
    teste: /^LM555|^NE555/i,
    tipo: "Temporizador (Timer) 555",
    descricao: "Circuito integrado temporizador clássico, usado para gerar pulsos, osciladores, PWM e temporizações em geral.",
  },
  {
    teste: /^LM358|^LM324|^LM741|^TL0[7-8]\d/i,
    tipo: "Amplificador operacional",
    descricao: "Circuito integrado amplificador operacional, usado em comparadores, filtros, amplificação de sinais e condicionamento de sensores.",
  },
  {
    teste: /^1N40(0[1-7])/i,
    tipo: "Diodo retificador",
    descricao: "Diodo retificador de propósito geral da série 1N400x, usado em fontes de alimentação para retificação de corrente.",
  },
  {
    teste: /^1N4148|^1N914/i,
    tipo: "Diodo de sinal (chaveamento rápido)",
    descricao: "Diodo de pequenos sinais, usado em chaveamento rápido e proteção de circuitos lógicos.",
  },
  {
    teste: /^1N47\d\d/i,
    tipo: "Diodo zener",
    descricao: "Diodo zener, usado para regulação/referência de tensão fixa quando polarizado reversamente.",
  },
  {
    teste: /^BC5[45]\d/i,
    tipo: "Transistor bipolar de sinal",
    descricao: "Transistor bipolar de pequenos sinais (BC547 = NPN, BC557 = PNP), usado em chaveamento e amplificação de baixa potência.",
  },
  {
    teste: /^2N22[12]\d|^2N3904|^2N3906/i,
    tipo: "Transistor bipolar",
    descricao: "Transistor bipolar de propósito geral, usado em chaveamento e amplificação.",
  },
  {
    teste: /^2N30[45]\d|^TIP(3[0-5]|1[0-4][0-9])/i,
    tipo: "Transistor de potência",
    descricao: "Transistor bipolar de potência, usado em estágios de saída, chaveamento de cargas maiores e fontes.",
  },
  {
    teste: /^IRF\d{3,4}/i,
    tipo: "MOSFET de potência",
    descricao: "Transistor MOSFET de potência, usado em chaveamento de alta corrente, fontes chaveadas e controle de motores.",
  },
  {
    teste: /^4N2[5-8]|^PC8[12]\d|^TLP\d{3,4}/i,
    tipo: "Optoacoplador",
    descricao: "Componente que transmite sinal elétrico por luz, isolando eletricamente dois circuitos (ex: entre controle e potência).",
  },
  {
    teste: /^74(HC|LS|HCT)?\d{2,3}/i,
    tipo: "Circuito integrado lógico (família 74xx)",
    descricao: "Circuito integrado de lógica digital da família 74xx, usado para portas lógicas, contadores, registradores e decodificadores.",
  },
  {
    teste: /rel[eé]|relay/i,
    tipo: "Relé eletromecânico",
    descricao: "Relé eletromecânico usado para chaveamento de cargas por meio de uma bobina de controle, isolando o circuito de comando do circuito de potência.",
  },
  {
    teste: /contator|contactor/i,
    tipo: "Contator",
    descricao: "Dispositivo eletromecânico de chaveamento para cargas de maior potência (motores, cargas industriais), acionado por bobina.",
  },
  {
    teste: /fus[íi]vel|fuse/i,
    tipo: "Fusível",
    descricao: "Dispositivo de proteção contra sobrecorrente, que interrompe o circuito ao derreter seu elemento interno quando a corrente ultrapassa o valor nominal.",
  },
  {
    teste: /encoder/i,
    tipo: "Encoder",
    descricao: "Sensor que converte movimento (rotação ou deslocamento linear) em sinal elétrico, usado para realimentação de posição/velocidade.",
  },
  {
    teste: /potenci[oô]metro|^B\d0?[0-9]0?K|^10K.?pot/i,
    tipo: "Potenciômetro",
    descricao: "Resistor variável de três terminais, usado para ajuste manual de tensão/sinal de referência.",
  },
  {
    teste: /^IGBT|^FGA\d|^IRG\d/i,
    tipo: "Transistor IGBT",
    descricao: "Transistor de potência que combina características de MOSFET e bipolar, usado em inversores, controle de motores e chaveamento de alta potência.",
  },
  {
    teste: /^\d+(\.\d+)?\s?(uF|µF|nF|pF)/i,
    tipo: "Capacitor",
    descricao: "Componente que armazena energia em campo elétrico, usado em filtros, desacoplamento e temporização.",
  },
  {
    teste: /^\d+(\.\d+)?\s?(ohm|Ω|k|K|M)\b/i,
    tipo: "Resistor",
    descricao: "Componente que limita/controla a corrente elétrica no circuito, dissipando energia em forma de calor.",
  },
];

// Recebe o texto digitado no campo "nome" e devolve a primeira sugestão
// que bater, ou null se não reconhecer nenhum padrão.
export function sugerirComponente(nome) {
  const texto = (nome || "").trim();
  if (texto.length < 3) return null;
  for (const item of BASE) {
    if (item.teste.test(texto)) {
      return { tipo: item.tipo, descricao: item.descricao };
    }
  }
  return null;
}
