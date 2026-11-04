// Testes end-to-end do Painel SAMU 192
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test.beforeEach(async ({ page }) => {
  page.on('dialog', d => d.accept());
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  page.erros = erros;
  await page.goto('/');
  await expect(page.locator('#kTotal')).not.toHaveText('0');
});

test.afterEach(async ({ page }) => {
  expect(page.erros, 'erros de JavaScript na página').toEqual([]);
});

async function novoAtendimento(page, r, botao = 'Salvar') {
  if (!(await page.locator('#ovForm').evaluate(el => el.classList.contains('show')))) {
    await page.getByRole('button', { name: 'Novo atendimento' }).click();
  }
  if (r.data) await page.fill('#iData', r.data);
  await page.fill('#iHora', r.hora);
  await page.fill('#iBairro', r.bairro);
  await page.fill('#iIdade', String(r.idade));
  if (r.sexo) await page.locator(`label[for="iSexo${r.sexo}"]`).click();
  if (r.motivo) await page.fill('#iMotivo', r.motivo);
  if (r.obito) await page.check('#iObito');
  await page.getByRole('button', { name: botao, exact: true }).click();
}

async function importar(page, nome, conteudo, modo = 'Substituir todos os dados') {
  await page.setInputFiles('#fileInput', { name: nome, mimeType: 'text/plain', buffer: Buffer.from(conteudo, 'utf-8') });
  await expect(page.locator('#ovImport')).toHaveClass(/show/);
  await page.getByRole('button', { name: modo }).click();
}

const kpi = (page, id) => page.locator(`#${id}`);

test.describe('Carregamento', () => {
  test('exibe dados de exemplo, indicadores e todos os gráficos', async ({ page }) => {
    await expect(page).toHaveTitle(/SAMU 192/);
    await expect(page.locator('#notice')).toBeVisible();
    await expect(kpi(page, 'kTotal')).toHaveText('40');
    await expect(kpi(page, 'kObitos')).toHaveText('4');
    await expect(kpi(page, 'kBairro')).toHaveText('Centro');
    await expect(kpi(page, 'kEsp')).toHaveText('Trauma');
    const graficos = await page.evaluate(() =>
      ['chartHora', 'chartSemana', 'chartIdade', 'chartBairro', 'chartEsp', 'chartObito', 'chartSexo', 'chartDia'].map(id => !!Chart.getChart(id)));
    expect(graficos.every(Boolean)).toBe(true);
    await expect(page.locator('#tbody tr')).toHaveCount(15);
    await expect(page.locator('#pager')).toContainText('de 40 registros');
  });

  test('imagens do SAMU carregam', async ({ page }) => {
    const ok = await page.evaluate(async () => {
      const carregar = src => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = src; });
      return [await carregar('assets/samu.jpg'), await carregar('assets/samu-logo.jpg'), typeof SAMU_LOGO === 'string' && SAMU_LOGO.startsWith('data:image/jpeg')];
    });
    expect(ok).toEqual([true, true, true]);
  });
});

test.describe('Regras de negócio', () => {
  test('faixas etárias: 0–1 neonatal, 2–5 e de 5 em 5 anos', async ({ page }) => {
    const r = await page.evaluate(() => [0, 1, 2, 5, 6, 10, 11, 25, 86, 90, 91, 110].map(faixaEtaria));
    expect(r).toEqual(['0-1', '0-1', '2-5', '2-5', '6-10', '6-10', '11-15', '21-25', '86-90', '86-90', '91+', '91+']);
    const opcoes = await page.locator('#fIdade option').allTextContents();
    expect(opcoes[0]).toBe('Todas');
    expect(opcoes[1]).toBe('0–1 ano (neonatal)');
    expect(opcoes[2]).toBe('2–5 anos');
    expect(opcoes[3]).toBe('6–10 anos');
    expect(opcoes.at(-1)).toBe('91+ anos');
    // 0–1, 2–5, 17 faixas de 5 anos (6–10 … 86–90) e 91+
    expect(opcoes.length).toBe(21);
    const labels = await page.evaluate(() => Chart.getChart('chartIdade').data.labels);
    expect(labels.length).toBe(20);
  });

  test('turno e dia da semana', async ({ page }) => {
    const r = await page.evaluate(() => [turno('06:59'), turno('07:00'), turno('18:59'), turno('19:00'), diaSemana('2026-11-01'), diaSemana('2026-11-02')]);
    expect(r).toEqual(['noite', 'dia', 'dia', 'noite', 0, 1]);
  });

  test('normalização de datas, horas, sexo e óbito na importação', async ({ page }) => {
    const r = await page.evaluate(() => [
      normalizarData('05/03/2026'), normalizarData('5/3/26'), normalizarData('2026-3-5'),
      normalizarRegistro({ Horário: '7h', Bairro: 'X', Idade: '3', Sexo: 'feminino', Especialidade: 'Pediátrico', Óbito: 'Sim', Data: '01/11/2026' }),
      normalizarRegistro({ hora: '10:00', bairro: 'X', idade: 'abc', sexo: 'M' }),
      normalizarRegistro({ hora: '10:00', bairro: 'X', idade: 30, sexo: '?' })
    ]);
    expect(r[0]).toBe('2026-03-05');
    expect(r[1]).toBe('2026-03-05');
    expect(r[2]).toBe('2026-03-05');
    expect(r[3]).toMatchObject({ data: '2026-11-01', hora: '07:00', bairro: 'X', idade: 3, sexo: 'F', motivo: 'Pediátrico', obito: true });
    expect(r[4]).toBeNull();
    expect(r[5]).toBeNull();
  });
});

test.describe('Cadastro diário', () => {
  test('cadastrar substitui os exemplos e atualiza os indicadores', async ({ page }) => {
    await novoAtendimento(page, { data: '2026-11-02', hora: '14:30', bairro: 'Vila Esperança', idade: 0, sexo: 'F', motivo: 'Neonatal', obito: true });
    await expect(page.locator('#ovForm')).not.toHaveClass(/show/);
    await expect(page.locator('#notice')).toBeHidden();
    await expect(kpi(page, 'kTotal')).toHaveText('1');
    await expect(kpi(page, 'kObitos')).toHaveText('1');
    await expect(kpi(page, 'kPico')).toHaveText('14h');
    await expect(kpi(page, 'kSemana')).toHaveText('Segunda');
    await expect(kpi(page, 'kBairro')).toHaveText('Vila Esperança');
    await expect(kpi(page, 'kIdadeRange')).toContainText('0–1 ano (neonatal)');
    const linha = page.locator('#tbody tr').first();
    await expect(linha).toContainText('02/11/2026');
    await expect(linha).toContainText('Neonatal');
    await expect(linha.locator('.tag-obito')).toHaveText('ÓBITO');
  });

  test('"Atendido por terceiros" desabilita idade, sexo e óbito e salva só data, hora, bairro e especialidade', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo atendimento' }).click();
    await page.fill('#iData', '2026-11-02');
    await page.fill('#iHora', '10:15');
    await page.fill('#iBairro', 'Centro');
    await page.fill('#iMotivo', 'Trauma');
    await page.check('#iTerceiros');
    await expect(page.locator('#iIdade')).toBeDisabled();
    await expect(page.locator('#iSexoM')).toBeDisabled();
    await expect(page.locator('#iObito')).toBeDisabled();
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('#ovForm')).not.toHaveClass(/show/);
    await expect(kpi(page, 'kTotal')).toHaveText('1');
    await expect(kpi(page, 'kTerceiros')).toHaveText('1');
    await expect(kpi(page, 'kIdade')).toHaveText('—');
    const r = await page.evaluate(() => DADOS[0]);
    expect(r).toMatchObject({ hora: '10:15', bairro: 'Centro', motivo: 'Trauma', idade: null, sexo: '', obito: false, terceiros: true });
    await expect(page.locator('#tbody tr').first().locator('.tag-terceiros')).toHaveText('TERCEIROS');
    // desmarcar reabilita os campos
    await page.getByRole('button', { name: 'Novo atendimento' }).click();
    await expect(page.locator('#iIdade')).toBeEnabled();
    await expect(page.locator('#iTerceiros')).not.toBeChecked();
  });

  test('"Salvar e cadastrar outro" mantém o formulário aberto e a data', async ({ page }) => {
    await novoAtendimento(page, { data: '2026-11-03', hora: '08:00', bairro: 'Centro', idade: 40, sexo: 'M', motivo: 'Trauma' }, 'Salvar e cadastrar outro');
    await expect(page.locator('#ovForm')).toHaveClass(/show/);
    await expect(page.locator('#iData')).toHaveValue('2026-11-03');
    await expect(page.locator('#iBairro')).toHaveValue('');
    await expect(page.locator('#iObito')).not.toBeChecked();
    await novoAtendimento(page, { hora: '09:00', bairro: 'Lapa', idade: 70, sexo: 'F', motivo: 'Clínico' });
    await expect(kpi(page, 'kTotal')).toHaveText('2');
    await expect(kpi(page, 'kSemana')).toHaveText('Terça');
  });

  test('valida sexo e idade', async ({ page }) => {
    await novoAtendimento(page, { hora: '10:00', bairro: 'Centro', idade: 30 });
    await expect(page.locator('#formErro')).toHaveText('Selecione o sexo do paciente.');
    await expect(page.locator('#ovForm')).toHaveClass(/show/);
    await page.locator('label[for="iSexoM"]').click();
    await page.fill('#iIdade', '150');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(page.locator('#ovForm')).toHaveClass(/show/);
    await expect(kpi(page, 'kTotal')).toHaveText('40');
  });

  test('editar e excluir atendimento', async ({ page }) => {
    await novoAtendimento(page, { data: '2026-11-02', hora: '10:00', bairro: 'Centro', idade: 30, sexo: 'M', motivo: 'Clínico' });
    await page.locator('#tbody tr').first().getByTitle('Editar').click();
    await expect(page.locator('#formTitulo')).toHaveText('Editar atendimento');
    await expect(page.locator('#btnSalvarOutro')).toBeHidden();
    await page.fill('#iBairro', 'Moema');
    await page.check('#iObito');
    await page.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(kpi(page, 'kTotal')).toHaveText('1');
    await expect(kpi(page, 'kBairro')).toHaveText('Moema');
    await expect(kpi(page, 'kObitos')).toHaveText('1');

    await page.locator('#tbody tr').first().getByTitle('Excluir').click();
    await expect(kpi(page, 'kTotal')).toHaveText('0');
    await expect(page.locator('#semDados')).toBeVisible();
  });

  test('dados persistem após recarregar a página', async ({ page }) => {
    await novoAtendimento(page, { data: '2026-11-02', hora: '10:00', bairro: 'Persistência', idade: 30, sexo: 'M' });
    await page.reload();
    await expect(kpi(page, 'kTotal')).toHaveText('1');
    await expect(kpi(page, 'kBairro')).toHaveText('Persistência');
    await expect(page.locator('#notice')).toBeHidden();
  });

  test('textos digitados não executam HTML', async ({ page }) => {
    await novoAtendimento(page, { hora: '10:00', bairro: '<img src=x onerror="window.__xss=1">', idade: 30, sexo: 'M' });
    await expect(page.locator('#tbody tr').first()).toContainText('<img src=x');
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('remover exemplos e apagar todos os dados', async ({ page }) => {
    await page.getByRole('button', { name: 'Remover exemplos' }).click();
    await expect(kpi(page, 'kTotal')).toHaveText('0');
    await novoAtendimento(page, { hora: '10:00', bairro: 'Centro', idade: 30, sexo: 'M' });
    await page.getByRole('button', { name: 'Apagar todos os dados' }).click();
    await expect(kpi(page, 'kTotal')).toHaveText('0');
  });
});

test.describe('Filtros', () => {
  test('sexo, óbito, especialidade, faixa etária, período e limpar', async ({ page }) => {
    await page.selectOption('#fSexo', 'F');
    await expect(kpi(page, 'kTotal')).toHaveText('18');
    await page.selectOption('#fSexo', '');

    await page.selectOption('#fObito', 'sim');
    await expect(kpi(page, 'kTotal')).toHaveText('4');
    await page.selectOption('#fObito', 'nao');
    await expect(kpi(page, 'kTotal')).toHaveText('36');
    await page.selectOption('#fObito', '');

    await page.selectOption('#fEsp', 'Trauma');
    await expect(kpi(page, 'kTotal')).toHaveText('13');
    await page.selectOption('#fEsp', '');

    await page.selectOption('#fIdade', '0-1');
    await expect(kpi(page, 'kTotal')).toHaveText('2');
    await page.selectOption('#fIdade', '');

    const hoje = await page.evaluate(() => hoje());
    await page.fill('#fIni', hoje);
    await page.fill('#fFim', hoje);
    await expect(kpi(page, 'kTotal')).toHaveText('6');
    await expect(page.locator('#heroPeriodo')).toContainText('Período');

    await page.getByRole('button', { name: /Limpar filtros/ }).click();
    await expect(kpi(page, 'kTotal')).toHaveText('40');
  });

  test('busca na tabela', async ({ page }) => {
    await page.fill('#busca', 'obstetrico');
    await expect(page.locator('#tbody tr')).toHaveCount(3);
  });
});

test.describe('Importação', () => {
  test('CSV com ponto e vírgula, cabeçalhos em português e linhas inválidas', async ({ page }) => {
    const csv = '﻿Data;Horário;Bairro;Idade;Sexo;Motivo / Especialidade;Óbito\r\n' +
      '02/11/2026;08:15;Centro;0;F;Neonatal;Sim\r\n' +
      '02/11/2026;09:30;"Vila; Nova";34;M;Trauma;Não\r\n' +
      '03/11/2026;21:00;Lapa;67;Feminino;Cardiológico;\r\n' +
      '03/11/2026;22:00;Lapa;;M;Clínico;\r\n';
    await page.setInputFiles('#fileInput', { name: 'dados.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
    await expect(page.locator('#importResumo')).toContainText('3');
    await expect(page.locator('#importResumo')).toContainText('1 linha(s) ignorada(s)');
    await page.getByRole('button', { name: 'Substituir todos os dados' }).click();
    await expect(kpi(page, 'kTotal')).toHaveText('3');
    await expect(kpi(page, 'kObitos')).toHaveText('1');
    await expect(page.locator('#fBairro option')).toContainText(['Todos', 'Centro', 'Lapa', 'Vila; Nova']);
  });

  test('mesclar adiciona aos dados atuais', async ({ page }) => {
    await page.getByRole('button', { name: 'Remover exemplos' }).click();
    await novoAtendimento(page, { hora: '10:00', bairro: 'Centro', idade: 30, sexo: 'M' });
    await importar(page, 'a.csv', 'hora,bairro,idade,sexo\n11:00,Lapa,20,F\n12:00,Lapa,21,M\n', 'Adicionar aos dados atuais');
    await expect(kpi(page, 'kTotal')).toHaveText('3');
  });

  test('JSON no formato antigo (lista aninhada, sem data)', async ({ page }) => {
    const json = JSON.stringify([[{ hora: '06:12', bairro: 'Centro', motivo: 'Dor torácica', idade: 56, sexo: 'M' }, { hora: '07:34', bairro: 'Vila Nova', motivo: 'Fratura', idade: 24, sexo: 'F' }]]);
    await importar(page, 'antigo.json', json);
    await expect(kpi(page, 'kTotal')).toHaveText('2');
    const hoje = await page.evaluate(() => brData(hoje()));
    await expect(page.locator('#tbody tr').first()).toContainText(hoje);
  });

  test('arquivo inválido mostra erro', async ({ page }) => {
    await page.setInputFiles('#fileInput', { name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{ isso não é json') });
    await expect(page.locator('#toast')).toHaveClass(/error/);
    await expect(kpi(page, 'kTotal')).toHaveText('40');
  });
});

test.describe('Exportação', () => {
  test('planilha CSV exporta e reimporta sem perder dados (inclusive colunas extras)', async ({ page }) => {
    await importar(page, 'x.csv', 'data;hora;bairro;idade;sexo;especialidade;obito;unidade\n02/11/2026;08:00;Centro;45;M;Trauma;Sim;USA 01\n02/11/2026;09:00;Lapa;3;F;Pediátrico;Não;USB 02\n');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar planilha' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^samu-atendimentos-\d{4}-\d{2}-\d{2}\.csv$/);
    const conteudo = fs.readFileSync(await download.path(), 'utf-8');
    const linhas = conteudo.replace(/^﻿/, '').trim().split(/\r\n/);
    expect(linhas[0]).toBe('data;hora;bairro;idade;sexo;especialidade;obito;terceiros;unidade');
    expect(linhas[1]).toBe('02/11/2026;08:00;Centro;45;M;Trauma;Sim;Não;USA 01');
    expect(linhas[2]).toBe('02/11/2026;09:00;Lapa;3;F;Pediátrico;Não;Não;USB 02');

    await importar(page, 'reimport.csv', conteudo);
    await expect(kpi(page, 'kTotal')).toHaveText('2');
    await expect(kpi(page, 'kObitos')).toHaveText('1');
    expect(await page.evaluate(() => DADOS.map(d => d.unidade))).toEqual(['USA 01', 'USB 02']);
  });

  test('PDF é gerado com relatório completo', async ({ page }) => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar PDF' }).click()]);
    expect(download.suggestedFilename()).toMatch(/^samu-relatorio-\d{4}-\d{2}-\d{2}\.pdf$/);
    const pdf = fs.readFileSync(await download.path());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const paginas = (pdf.toString('latin1').match(/\/Type \/Page[^s]/g) || []).length;
    expect(paginas).toBeGreaterThanOrEqual(6);
    expect(pdf.length).toBeLessThan(2 * 1024 * 1024);
  });

  test('exportar sem dados avisa o usuário', async ({ page }) => {
    await page.getByRole('button', { name: 'Remover exemplos' }).click();
    await page.getByRole('button', { name: 'Exportar PDF' }).click();
    await expect(page.locator('#toast')).toContainText('Não há atendimentos');
  });
});

test.describe('Layout', () => {
  test('celular sem rolagem horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const largura = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largura).toBeLessThanOrEqual(390);
  });
});
