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
