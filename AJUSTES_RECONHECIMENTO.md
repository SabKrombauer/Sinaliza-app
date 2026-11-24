# Melhorias iniciais da câmera — Sinaliza

Esta branch parte da integração `feat/integracao-duomanos-camera`,
mantendo os estudos e o layout.

## O que muda

- A câmera e a API já aceitam **até duas mãos** (`numHands: 2` no MediaPipe
  do navegador e `num_hands=2` no Python).
- O cabeçalho mostra a quantidade de mãos retornada pela API.
- Uma palavra é confirmada depois de **2 previsões iguais** com confiança
  >= 72% (valor de teste: pode precisar de ajuste).
- Ao mudar de sinal, a nova palavra não precisa esperar que a mão desapareça.
- Para repetir exatamente a mesma palavra, afaste as mãos da câmera por pelo
  menos duas leituras e faça o sinal novamente.
- O navegador captura aproximadamente a cada **250 ms**, mas a taxa real é
  limitada pelo tempo de processamento da API.
- A previsão aparece como candidata mesmo com confiança baixa, para ajudar
  a identificar sinais confundidos.

**Observação:** isso acelera a classificação de sinais estáticos, mas **não
faz o modelo antigo reconhecer movimentos**. O sinal OI pode continuar
confuso até que haja coleta e treinamento de sequências temporais.

## Como testar

1. Baixe/abra a branch `feat/reconhecimento-duas-maos-movimento`.
2. No Sinaliza, mantenha `.env.local` apontando para sua API Python local.
3. Execute `npm install --legacy-peer-deps` (se necessário) e
   `npm run dev`.
4. Inicie a API do DuoManos normalmente em outro terminal.
5. Ative a câmera e experimente **EU TE AMO → OI → TRABALHAR**,
   observando se a candidata aparece e a confiança é baixa.

Para preparar o modelo com movimento, veja `SEQUENCIAS_LIBRAS.md` na
branch `feat/camera-libras-api` do repositório DuoManos.

A validação com webcam real e novos dados ainda precisa ser feita
localmente. Não confunda previsão de um sinal isolado com tradução completa
da Língua Brasileira de Sinais.


## Integração de movimentos (branch experimental)

A branch `feat/integracao-sequencias-ao-vivo` permite que a câmera continue
enviando imagens para `POST /reconhecer`, com um ID aleatorio de sessao
(formulario `sessao`), sem misturar movimentos entre cameras. No Python,
a janela de ~2 segundos e classificada pelo `modelo_sequencias.pkl`.

O Sinaliza continua compatível com a API antiga: quando
`temporal_disponivel` não é retornado, permanece em modo estático.
Se o novo modelo estiver carregado, reduz o intervalo alvo de captura de
250 ms para 110 ms, limitado pela velocidade real do computador.
O indicador da câmera mostra quando o reconhecimento é estático
ou baseado em sequência.

### Passos locais

1. Na pasta **DuoManos-git**, atualize para a branch do mesmo nome.
2. Execute `treinar_sequencias.py` depois de coletar diferentes sinais;
   isso deve criar `modelo_sequencias.pkl` ao lado do `api.py`.
3. Pare o servidor Python antigo da porta 8000. Inicie a API pela pasta
   **DuoManos-git**, não pela pasta ZIP antiga.
4. Abra `http://127.0.0.1:8000/saude`; confira
   `"modelo_temporal": true`. Caso contrário, verifique se o treinamento
   gerou o arquivo, seu caminho e se a API foi reiniciada.
5. Na pasta **Sinaliza-app**, atualize para
   `feat/integracao-sequencias-ao-vivo`, mantenha
   `.env.local` com `VITE_LIBRAS_API_URL=http://127.0.0.1:8000`
   e execute `npm run dev`.
6. Teste a transição entre sinais estáticos e sinais em movimento,
   incluindo exemplos de uma e de duas mãos.

Ainda é uma **integração experimental**: necessita de testes locais,
coleta variada, calibração de limiares e avaliação com pessoas fluentes
em Libras. Não significa tradução completa de frases.
