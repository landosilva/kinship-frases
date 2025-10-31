# Configuração do Google Apps Script

Para habilitar a escrita na planilha do Google Sheets, você precisa criar um Google Apps Script que atuará como uma API.

## Passo 1: Criar o Google Apps Script

1. Vá para https://script.google.com/
2. Clique em "Novo projeto"
3. Cole o seguinte código:

```javascript
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetId = '1ajnPZy6u6nw-g5GE5ZbortN53JZ9SBkl9RYB9TxMFqs';
    
    const ss = SpreadsheetApp.openById(sheetId);
    // Use a primeira aba da planilha
    // Se sua planilha tiver múltiplas abas, altere o índice ou use getSheetByName('NomeDaAba')
    const sheet = ss.getSheets()[0];
    
    if (data.action === 'append') {
      sheet.appendRow(data.data);
      return ContentService
        .createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: 'Ação não suportada'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({message: 'Google Apps Script está funcionando!'}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Passo 2: Configurar Permissões

1. Clique em "Executar" > "doGet" (para testar)
2. Autorize o acesso quando solicitado
3. Revise as permissões e clique em "Permitir"

## Passo 3: Publicar como Web App

1. Clique em "Implantar" > "Nova implantação"
2. Selecione o tipo: "Aplicativo da Web"
3. Configure:
   - **Descrição**: "API para escrita na planilha"
   - **Executar como**: "Eu mesmo"
   - **Quem tem acesso**: "Qualquer pessoa"
4. Clique em "Implantar"
5. **Copie a URL fornecida** - esta é sua URL do Web App

## Passo 4: Configurar no Site

1. Abra o arquivo `script.js`
2. Encontre a linha:
   ```javascript
   const WEB_APP_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';
   ```
3. Substitua `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` pela URL copiada no Passo 3
4. Salve o arquivo

## Passo 5: Publicar no GitHub Pages

1. Faça commit e push dos arquivos para o repositório GitHub
2. Vá para as configurações do repositório no GitHub
3. Navegue até "Pages" no menu lateral
4. Selecione a branch `main` e a pasta `/ (root)`
5. Clique em "Save"
6. Seu site estará disponível em `https://[seu-usuario].github.io/kinship-frases/`

## Notas Importantes

- A leitura funciona diretamente via CSV público do Google Sheets
- A escrita requer o Google Apps Script configurado
- Certifique-se de que a planilha está configurada para permitir acesso público (ou configure autenticação apropriada)
- O Google Apps Script tem cotas de execução diárias, mas são generosas para uso pessoal

## Solução de Problemas

### Erro de CORS
Se você receber erros de CORS, certifique-se de que:
- A configuração "Quem tem acesso" está como "Qualquer pessoa"
- A URL do Web App está correta no `script.js`

### Erro de Permissão
Se houver erro de permissão:
- Verifique se o script foi autorizado corretamente
- Certifique-se de que o ID da planilha está correto no código do Apps Script

