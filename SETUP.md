# Configuração do Google Apps Script

Para habilitar a escrita na planilha do Google Sheets, você precisa criar um Google Apps Script que atuará como uma API.

## Passo 1: Criar o Google Apps Script

1. Vá para https://script.google.com/
2. Clique em "Novo projeto"
3. Cole o seguinte código:

```javascript
function doPost(e) {
  try {
    let data;
    
    // Try to parse from postData.contents (JSON body)
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    // Try to parse from parameter (form data)
    else if (e.parameter && e.parameter.postData) {
      data = JSON.parse(e.parameter.postData);
    }
    // Fallback: try to get from raw postData
    else if (e.postData) {
      data = JSON.parse(e.postData);
    } else {
      throw new Error('Nenhum dado recebido');
    }
    
    const sheetId = '1ajnPZy6u6nw-g5GE5ZbortN53JZ9SBkl9RYB9TxMFqs';
    
    const ss = SpreadsheetApp.openById(sheetId);
    
    // Handle different actions
    if (data.action === 'append') {
      // Add new phrase to Phrases sheet
      const sheet = ss.getSheetByName('Phrases');
      if (!sheet) {
        return ContentService
          .createTextOutput(JSON.stringify({success: false, error: 'Aba "Phrases" não encontrada'}))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeaders({'Access-Control-Allow-Origin': '*'});
      }
      
      // Append phrase with initial rating of 0
      sheet.appendRow([data.data[0], 0]);
      
      return ContentService
        .createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({'Access-Control-Allow-Origin': '*'});
        
    } else if (data.action === 'vote') {
      // Save vote to Votes sheet and update rating in Phrases sheet
      // Rating is now 0-5 (stars) instead of -1, 0, 1
      
      // Get or create Votes sheet
      let votesSheet = ss.getSheetByName('Votes');
      if (!votesSheet) {
        votesSheet = ss.insertSheet('Votes');
        votesSheet.appendRow(['Id', 'Votes']);
      }
      
      // Check if user already exists
      const userId = data.userId;
      const rating = data.rating || 0; // 0-5 stars
      const phraseIndex = data.phraseIndex;
      const votesString = data.votes || '';
      
      // Find existing row for this user
      const votesData = votesSheet.getDataRange().getValues();
      let userRowIndex = -1;
      
      for (let i = 1; i < votesData.length; i++) {
        if (votesData[i][0] === userId) {
          userRowIndex = i + 1; // +1 because sheets are 1-indexed
          break;
        }
      }
      
      // Update or create user vote record
      if (userRowIndex > 0) {
        // Update existing
        votesSheet.getRange(userRowIndex, 2).setValue(votesString);
      } else {
        // Create new
        votesSheet.appendRow([userId, votesString]);
      }
      
      // Update rating in Phrases sheet
      const phrasesSheet = ss.getSheetByName('Phrases');
      if (phrasesSheet) {
        // Get all votes from all users
        const allVotes = votesSheet.getDataRange().getValues();
        let totalRating = 0;
        let voteCount = 0;
        
        // Calculate average rating for this phrase from all users (0-5 stars)
        for (let i = 1; i < allVotes.length; i++) {
          const userVotesStr = allVotes[i][1];
          if (userVotesStr && userVotesStr.toString().trim() !== '') {
            const votes = userVotesStr.toString().split(',').map(v => v.trim());
            if (votes.length > phraseIndex && votes[phraseIndex] !== '') {
              const userRating = parseInt(votes[phraseIndex]);
              if (!isNaN(userRating) && userRating >= 0 && userRating <= 5) {
                totalRating += userRating;
                voteCount++;
              }
            }
          }
        }
        
        // Calculate average rating (you can also store sum if you prefer)
        const averageRating = voteCount > 0 ? Math.round((totalRating / voteCount) * 10) / 10 : 0;
        
        // Update rating in Phrases sheet (phraseIndex + 2 because header is row 1, and sheets are 1-indexed)
        const ratingRow = phraseIndex + 2; // +1 for header, +1 for 0-index to 1-index
        if (ratingRow <= phrasesSheet.getLastRow()) {
          // Store average rating (or you can store totalRating if you prefer sum)
          phrasesSheet.getRange(ratingRow, 2).setValue(averageRating);
        }
      }
      
      return ContentService
        .createTextOutput(JSON.stringify({success: true}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({'Access-Control-Allow-Origin': '*'});
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: 'Ação não suportada'}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({'Access-Control-Allow-Origin': '*'});
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({'Access-Control-Allow-Origin': '*'});
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({message: 'Google Apps Script está funcionando!'}))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({'Access-Control-Allow-Origin': '*'});
}

function doOptions() {
  return ContentService
    .createTextOutput('')
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
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

