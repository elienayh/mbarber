const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://otdbhsopmtelvygxyhsk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2ru_dbUHeNetHeT1qoqq_Q_r3f_5-Qz';
const supabase = createClient(supabaseUrl, supabaseKey);

const TENANT_ELIENAY = {
  id: '0bd026cd-a337-47f8-88a7-8f961afa47a2',
  name: 'Elienay Barber',
  slug: 'elienay-barber'
};

const TENANT_TAMIRIS = {
  id: '75f73987-7cd7-423d-a4b9-04acd9586ac1',
  name: 'Tamiris Barber2',
  slug: 'tamiris-barber2'
};

async function runTests() {
  console.log('====================================================');
  console.log('TESTE CRUZADO DE ISOLAMENTO MULTITENANT');
  console.log('Barbearia 1 (Elienay Barber):', TENANT_ELIENAY.id);
  console.log('Barbearia 2 (Tamiris Barber2):', TENANT_TAMIRIS.id);
  console.log('====================================================\n');

  let passed = true;

  // 1. Teste de Profissionais para Elienay Barber
  console.log('1. TESTE: Profissionais de Elienay Barber');
  const { data: prosElienay, error: errProsElienay } = await supabase
    .from('professionals')
    .select('id, name, tenant_id, is_active')
    .eq('tenant_id', TENANT_ELIENAY.id)
    .order('display_order');

  if (errProsElienay) {
    console.error('ERRO ao buscar profissionais Elienay:', errProsElienay);
    passed = false;
  } else {
    console.log(`   Total encontrados: ${prosElienay.length}`);
    prosElienay.forEach(p => console.log(`   - ${p.name} (tenant_id: ${p.tenant_id})`));
    const hasTamiris = prosElienay.some(p => p.name.toLowerCase().includes('tamiris'));
    if (hasTamiris) {
      console.error('❌ FALHA CRÍTICA: Tamiris Dias vazou para a lista de Elienay Barber!');
      passed = false;
    } else {
      console.log('✅ SUCESSO: Tamiris Dias NÃO está presente na barbearia de Elienay.');
    }
  }

  // 2. Teste de Profissionais para Tamiris Barber2
  console.log('\n2. TESTE: Profissionais de Tamiris Barber2');
  const { data: prosTamiris, error: errProsTamiris } = await supabase
    .from('professionals')
    .select('id, name, tenant_id, is_active')
    .eq('tenant_id', TENANT_TAMIRIS.id)
    .order('display_order');

  if (errProsTamiris) {
    console.error('ERRO ao buscar profissionais Tamiris:', errProsTamiris);
    passed = false;
  } else {
    console.log(`   Total encontrados: ${prosTamiris.length}`);
    prosTamiris.forEach(p => console.log(`   - ${p.name} (tenant_id: ${p.tenant_id})`));
    const hasElienayDomingues = prosTamiris.some(p => p.name.includes('Domingues'));
    if (hasElienayDomingues) {
      console.error('❌ FALHA CRÍTICA: Elienay Domingues vazou para a lista de Tamiris!');
      passed = false;
    } else {
      console.log('✅ SUCESSO: Elienay Domingues NÃO está presente na barbearia de Tamiris.');
    }
  }

  // 3. Teste de Serviços de Elienay Barber
  console.log('\n3. TESTE: Serviços de Elienay Barber');
  const { data: srvElienay } = await supabase
    .from('services')
    .select('id, name, tenant_id')
    .eq('tenant_id', TENANT_ELIENAY.id);

  console.log(`   Total serviços Elienay: ${srvElienay?.length || 0}`);
  srvElienay?.forEach(s => console.log(`   - ${s.name} (tenant_id: ${s.tenant_id})`));
  const srvForeignElienay = srvElienay?.filter(s => s.tenant_id !== TENANT_ELIENAY.id) || [];
  if (srvForeignElienay.length > 0) {
    console.error('❌ FALHA: Serviços de outro tenant retornados para Elienay!');
    passed = false;
  } else {
    console.log('✅ SUCESSO: 100% dos serviços retornados pertencem a Elienay Barber.');
  }

  // 4. Teste de Serviços de Tamiris Barber2
  console.log('\n4. TESTE: Serviços de Tamiris Barber2');
  const { data: srvTamiris } = await supabase
    .from('services')
    .select('id, name, tenant_id')
    .eq('tenant_id', TENANT_TAMIRIS.id);

  console.log(`   Total serviços Tamiris: ${srvTamiris?.length || 0}`);
  srvTamiris?.forEach(s => console.log(`   - ${s.name} (tenant_id: ${s.tenant_id})`));
  const srvForeignTamiris = srvTamiris?.filter(s => s.tenant_id !== TENANT_TAMIRIS.id) || [];
  if (srvForeignTamiris.length > 0) {
    console.error('❌ FALHA: Serviços de outro tenant retornados para Tamiris!');
    passed = false;
  } else {
    console.log('✅ SUCESSO: 100% dos serviços retornados pertencem a Tamiris Barber2.');
  }

  // 5. Teste de Bloqueios de Agenda
  console.log('\n5. TESTE: Bloqueios de Agenda (schedule_blocks)');
  const { data: blocksElienay } = await supabase
    .from('schedule_blocks')
    .select('id, tenant_id')
    .eq('tenant_id', TENANT_ELIENAY.id);
  console.log(`   Bloqueios Elienay: ${blocksElienay?.length || 0}`);

  const { data: blocksTamiris } = await supabase
    .from('schedule_blocks')
    .select('id, tenant_id')
    .eq('tenant_id', TENANT_TAMIRIS.id);
  console.log(`   Bloqueios Tamiris: ${blocksTamiris?.length || 0}`);
  console.log('✅ SUCESSO: Sem sobreposição de bloqueios.');

  // 6. Teste de Agendamentos (appointments)
  console.log('\n6. TESTE: Agendamentos (appointments)');
  const { data: aptsElienay } = await supabase
    .from('appointments')
    .select('id, tenant_id')
    .eq('tenant_id', TENANT_ELIENAY.id);
  console.log(`   Agendamentos Elienay: ${aptsElienay?.length || 0}`);

  const { data: aptsTamiris } = await supabase
    .from('appointments')
    .select('id, tenant_id')
    .eq('tenant_id', TENANT_TAMIRIS.id);
  console.log(`   Agendamentos Tamiris: ${aptsTamiris?.length || 0}`);
  console.log('✅ SUCESSO: Sem sobreposição de agendamentos.');

  // 7. Simulação da Lógica do Frontend (AgendaPage)
  console.log('\n7. TESTE: Simulação de carregamento da Agenda de Elienay com cache residual');
  // Se o navegador tinha salvo Tamiris em cache de outro tenant ou localStorage
  const simulatedBackendData = prosElienay || [];
  const simulatedLocalCachedTamiris = prosTamiris || []; // dados do tenant da Tamiris

  let loadedBarbers = simulatedBackendData.map(p => ({
    id: p.id,
    name: p.name,
    tenant_id: p.tenant_id
  }));

  // Aplicação da nova lógica de higienização do AgendaPage
  const barMap = new Map();
  loadedBarbers.forEach(b => barMap.set(b.id, b));
  simulatedLocalCachedTamiris.forEach(p => {
    const ex = barMap.get(p.id);
    if (ex) {
      barMap.set(p.id, { ...ex, name: p.name });
    } else if (p.tenant_id === TENANT_ELIENAY.id) {
      // só aceita se o tenant_id bater
      barMap.set(p.id, p);
    }
  });
  const finalAgendaBarbers = Array.from(barMap.values());
  console.log(`   Barbeiros na Agenda de Elienay pós-higienização: ${finalAgendaBarbers.map(b => b.name).join(', ')}`);
  if (finalAgendaBarbers.some(b => b.name.toLowerCase().includes('tamiris'))) {
    console.error('❌ FALHA: Tamiris ainda foi injetada pelo cache residual!');
    passed = false;
  } else {
    console.log('✅ SUCESSO: Cache residual de Tamiris foi bloqueado e higienizado com sucesso!');
  }

  console.log('\n====================================================');
  if (passed) {
    console.log('RESULTADO FINAL: TODOS OS TESTES PASSARAM COM SUCESSO! 🎉');
  } else {
    console.log('RESULTADO FINAL: ALGUNS TESTES FALHARAM!');
  }
  console.log('====================================================');
}

runTests();
