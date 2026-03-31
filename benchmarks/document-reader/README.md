# Benchmark - Document Reader

Objetivo: validar qualidade do leitor documental em dados reais antes de escala.

## Meta inicial

- 100 documentos totais
- 20 documentos com ground truth revisado manualmente
- Cobrir PDF nativo, PDF escaneado, imagens, DOCX

## Arquivos

- dataset-template.csv: modelo para catalogar dataset

## Metricas recomendadas

- CER (Character Error Rate)
- WER (Word Error Rate)
- Cobertura minima por documento (chars extraidos)
- Taxa de sucesso tecnico (processou sem erro)

## Criterios iniciais

- Success rate >= 95%
- quality=none <= 3%
- WER medio <= 15% nos 20 docs com ground truth
