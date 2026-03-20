# Bible API (YouVersion Platform)

Esta integração usa a **YouVersion Platform API**. Para utilizar:
- Solicite acesso e gere sua `YVP_APP_KEY` no portal oficial.
- Nunca commite a chave no GitHub.

Configuração (Render / local):
```
YVP_APP_KEY=seu_app_key
YVP_BIBLE_ID=3034
```

Endpoint no GROOT:
```
GET /bible/passage?passage=JHN.3.16
GET /bible/passage?bibleId=3034&passage=MAT.3.1-6
```

Observações:
- Respeite as licenças e atribuições exigidas pela YouVersion.
- Não faça ingestão em massa sem autorização.
