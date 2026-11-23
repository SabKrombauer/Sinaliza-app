# Câmera do Sinaliza + reconhecimento do DuoManos

Esta versão **preserva Estudos, Tradutor, Dicionário e Conta**.
A câmera web do Sinaliza continua desenhando o esqueleto da mão com
MediaPipe, mas envia frames periódicos ao modelo Random Forest treinado no
DuoManos (servidor Python). O modo demonstração continua independente.

## 1. Execute a API do DuoManos

Use a branch `feat/camera-libras-api` do repositório
`SabKrombauer/appDuoManos` (a API recebeu a configuração de CORS).

No computador, na raiz do DuoManos:

```powershell
python -m pip install -r requirements-api.txt
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

Teste `http://127.0.0.1:8000/saude`.
O servidor precisa ter `modelo_libras.pkl` e `hand_landmarker.task`
originais na mesma pasta de `api.py`.

## 2. Execute o Sinaliza no mesmo computador

No diretório deste repositório, crie um arquivo `.env.local`:

```env
VITE_LIBRAS_API_URL=http://127.0.0.1:8000
```

Instale e execute o frontend:

```powershell
npm install
npm run dev
```

Abra o endereço localhost informado pelo Vite e entre em **Câmera**.
Autorize o acesso à webcam e clique em **Ativar Câmera**.

### Se usar outras portas ou endereços

O Python permite origens `http://localhost:5173`, `http://127.0.0.1:5173`,
`http://localhost:3000` e `http://127.0.0.1:3000` por padrão.

Se o Vite usar outra origem, configure a variável `CORS_ORIGINS`
antes de iniciar o Python (exemplo PowerShell):

```powershell
$env:CORS_ORIGINS="http://localhost:5174,http://127.0.0.1:5174"
python -m uvicorn api:app --host 0.0.0.0 --port 8000
```

## Limitações importantes

- O modelo atual reconhece **sinais isolados** treinados, não toda a Libras.
- A câmera envia uma foto JPEG aproximadamente a cada 750 ms; não é
  transmissão contínua de vídeo nem reconhece movimentos temporais complexos.
- A análise de mãos e a classificação repetem trabalho no navegador e no
  servidor, adequado apenas como integração inicial.
- O servidor não possui autenticação; use **somente rede privada** e não
  publique a porta 8000 na internet.
- O acesso à webcam pelo navegador geralmente requer HTTPS ou localhost.
  Uma página HTTPS não consegue simplesmente enviar imagens para um endpoint
  HTTP remoto (mixed content). Para testar no celular use HTTPS apropriado
  no frontend e na API, ou mantenha os primeiros testes no computador.
- **O PWA não é um APK Android nativo.** A conversão para APK será uma etapa
  posterior, após validar o reconhecimento.
- Para evitar alucinações de reconhecimento, sem API configurada a câmera
  apenas mostra o rastreamento de pontos; a classificação por regras
  permanece disponível somente no **Modo Demonstração**, com dados simulados.

## Verificação do reconhecimento

Com API rodando, faça um dos sinais cadastrados no modelo original.
O sinal só é adicionado ao texto após confirmação repetida. Se a câmera
abrir mas nada reconhecer, verifique o console do navegador, a janela
do servidor Python, o endereço da API, as permissões da webcam e o
espelhamento da imagem.
