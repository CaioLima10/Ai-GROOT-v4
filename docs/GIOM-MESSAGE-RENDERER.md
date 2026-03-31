# GIOM Message Renderer

## Payload Canonico

```ts
export interface GIOMMessage {
  id: string;
  type:
    | "text"
    | "code"
    | "document"
    | "prompt"
    | "checklist"
    | "table"
    | "timeline"
    | "image"
    | "video"
    | "map"
    | "data";
  content: string | Record<string, unknown> | Array<unknown>;
  language?: string;
  meta?: Record<string, unknown>;
}
```

## Exemplos Por Tipo

```ts
const examples: GIOMMessage[] = [
  { id: "1", type: "text", content: "Resposta simples em texto." },
  { id: "2", type: "code", language: "typescript", content: "const total = items.reduce((acc, v) => acc + v, 0);" },
  {
    id: "3",
    type: "document",
    content: {
      title: "Relatorio de Sprint",
      sections: [
        { heading: "Resumo", body: "Entrega dentro do prazo." },
        { heading: "Riscos", body: "Dependencia externa no modulo X." }
      ]
    }
  },
  { id: "4", type: "prompt", content: "Crie uma landing page para produto SaaS com foco em conversao." },
  {
    id: "5",
    type: "checklist",
    content: [
      { label: "Validar requisitos", checked: true },
      { label: "Implementar UI", checked: false }
    ]
  },
  {
    id: "6",
    type: "table",
    content: {
      columns: ["Metrica", "Valor"],
      rows: [["CTR", "6.2%"], ["CAC", "R$ 32,10"]]
    }
  },
  {
    id: "7",
    type: "timeline",
    content: [
      { time: "09:00", title: "Kickoff", description: "Alinhar escopo" },
      { time: "11:00", title: "Implementacao", description: "Entrega do modulo" }
    ]
  },
  {
    id: "8",
    type: "image",
    content: {
      url: "https://images.example.com/preview.png",
      alt: "Mockup home"
    },
    meta: { prompt: "Mockup limpo estilo Notion" }
  },
  {
    id: "9",
    type: "video",
    content: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Demo" }
  },
  {
    id: "10",
    type: "map",
    content: { lat: -23.5505, lng: -46.6333, zoom: 13, label: "Sao Paulo" }
  },
  {
    id: "11",
    type: "data",
    content: {
      temperatura: "24 C",
      umidade: "68%",
      vento: "9 km/h"
    }
  }
];
```

## Pipeline

1. Backend/RAG envia `GIOMMessage` com `type` correto.
2. Front chama `MessageRenderer`.
3. Cada bloco aplica acoes SVG de copiar/editar.
4. Blocos longos usam scroll interno.
5. Mobile usa largura total com overflow horizontal em tabela/codigo.
