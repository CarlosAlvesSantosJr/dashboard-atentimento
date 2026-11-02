# Painel Estatístico de Atendimentos · SAMU 192

Painel web para lançar os atendimentos diários do SAMU e apresentar as métricas: idade (faixas 0–1 neonatal, 2–5 e de 5 em 5 anos), bairro, horários de pico, dias da semana, especialidades e óbitos. Gera relatório em PDF e exporta/importa planilha para edição.

## Rodar com Docker (recomendado)

Pré-requisitos: [Git](https://git-scm.com/) e [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/CarlosAlvesSantosJr/dashboard-atentimento.git
cd dashboard-atentimento
docker compose up -d --build
```

Acesse **http://localhost:8080**.

Se a porta 8080 já estiver em uso, escolha outra:

```bash
# Linux / macOS / Git Bash
PORTA=8085 docker compose up -d --build

# PowerShell
$env:PORTA=8085; docker compose up -d --build
```

Comandos úteis:

| Ação | Comando |
|---|---|
| Parar | `docker compose down` |
| Atualizar após `git pull` | `docker compose up -d --build` |
| Ver logs | `docker compose logs -f` |

Para acessar de outros computadores da rede, use `http://IP-DA-MAQUINA:8080`.

> A página usa bibliotecas via CDN (Chart.js, jsPDF), então o navegador precisa de acesso à internet.

## Onde ficam os dados

Os atendimentos são salvos **no navegador** de quem usa o painel (localStorage). Cada computador/navegador tem seus próprios dados. Para levar os dados para outra máquina ou fazer backup:

1. **Exportar planilha** → gera um CSV (abre no Excel).
2. Na outra máquina, **Importar** → escolha *Adicionar* ou *Substituir*.

Colunas da planilha: `data;hora;bairro;idade;sexo;especialidade;obito` (`obito` = Sim/Não). Colunas extras que você adicionar no Excel são mantidas na importação.

## Testes

```bash
npm install
npm test                                   # sobe um servidor local e testa
BASE_URL=http://localhost:8080 npm test    # testa o container Docker
```

Os testes (Playwright) usam o Google Chrome instalado na máquina. Sem Chrome, rode `npx playwright install chromium` e use `PW_CHANNEL=chromium npm test`.

## Sem Docker

```bash
npm start   # http://localhost:8080
```

Ou simplesmente abra o `index.html` no navegador.
