# Biblioteca Privada

Pipeline novo para subir e indexar bibliotecas privadas mistas do GIOM.

## O que ele lê hoje

- `PDF` via `pdf-parse`
- `TXT`, `MD`, `JSON`, `CSV`, `TSV`, `HTML`, `XML`, `YML`, `YAML`, `SVG`
- `DOCX` via `mammoth`
- imagens via `OCR` quando o modo `--ocr` estiver ativo

## Comando principal

```bash
npm run knowledge:private-library -- --dir c:\Users\GabeG\Desktop\LIVROS --prefix preaching-library --index-mode full
```

Com classificacao tematica automatica (idiomas, teologia, ciencia, jogos, GPS/satelites):

```bash
npm run knowledge:private-library -- --dir c:\Users\GabeG\Desktop\LIVROS --prefix private-library --index-mode full --topics-file knowledge/docs/private-library-topics.json --rights user_provided_or_public_domain
```

## Modos úteis

Catálogo rápido:

```bash
npm run knowledge:private-library -- --dir c:\Users\GabeG\Desktop\LIVROS --prefix preaching-library --index-mode catalog
```

Dry-run:

```bash
npm run knowledge:private-library -- --dir c:\Users\GabeG\Desktop\LIVROS --prefix preaching-library --index-mode catalog --dry-run
```

OCR explícito:

```bash
npm run knowledge:private-library -- --dir c:\Users\GabeG\Desktop\LIVROS --prefix preaching-library --index-mode full --ocr
```

Filtro por tema:

```bash
npm run knowledge:private-library -- --dir c:\Users\GabeG\Desktop\LIVROS --prefix private-library --match hebraico --index-mode catalog
```

## Observações

- O script gera manifesto em `knowledge/imported/private-library-manifest.json`.
- Se um PDF não devolver texto útil, o pipeline registra um catálogo sintético para não perder a obra.
- O OCR fica desligado por padrão no pipeline de ingestão para não quebrar a carga quando o runtime não tiver modelo local ou acesso para baixar dados do `tesseract`.
- Para bibliotecas de pregação e sermões, o script já infere metadados de `homiletics_preaching`, `devotional_practice`, `pastoral_theology`, `church_history` e `protestant_preaching_traditions`.
- O arquivo `knowledge/docs/private-library-topics.json` permite mapear dominios grandes (idiomas, arqueologia cristao-judaica-hebraica, teologia protestante, pais da igreja, ciencias, jogos, astronomia e GPS).
- O campo `rightsDeclaration` e salvo no metadata para rastrear origem legal do acervo.
- O pipeline nao valida copyright automaticamente. Suba apenas material proprio, publico, licenciado ou com autorizacao explicita.
