# Bible API (YouVersion Platform)

Esta integração usa a **YouVersion Platform API**. Para utilizar:
- Solicite acesso e gere sua `YVP_APP_KEY` no portal oficial.
- Nunca commite a chave no GitHub.

Configuração (Render / local):
```
YVP_APP_KEY=seu_app_key
YVP_BIBLE_ID=3034
YVP_BIBLE_ID_NAA=xxxx
YVP_BIBLE_ID_ARC=xxxx
YVP_BIBLE_ID_ARA=xxxx
YVP_BIBLE_ID_KJV1611=xxxx
YVP_BIBLE_ID_GREEK_NT=xxxx
YVP_BIBLE_ID_HEBREW_OT=xxxx
```

Endpoint no GROOT:
```
GET /bible/passage?passage=JHN.3.16
GET /bible/passage?bibleId=3034&passage=MAT.3.1-6
GET /bible/passage?bibleCode=NAA&passage=JHN.3.16
GET /bible/passage?bibleCode=KJV1611&passage=GEN.1.1-3
```

Observações:
- Respeite as licenças e atribuições exigidas pela YouVersion.
- Não faça ingestão em massa sem autorização.
