// ===== Configuração da API =====
const API_BASE_URL = 'https://clube-pet-api-1.onrender.com';

// ===== Estado e preços =====
let clientes = [];
let pets = [];
let hospedagens = [];
let creches = [];
let mensagens = []; // Histórico de comunicação
let avaliacoes = []; // Avaliações de satisfação
let inadimplencias = []; // Controle de inadimplência
let nextClienteId = 1, nextPetId = 1, nextHospedagemId = 1, nextCrecheId = 1, nextMensagemId = 1, nextAvaliacaoId = 1, nextInadimplenciaId = 1;

let precos = {
  hospedagem: { pequeno:80, medio:100, grande:120, gigante:150 },
  creche: {
    meio: {
      pequeno: 40,
      medio: 50,
      grande: 60,
      gigante: 70
    },
    integral: {
      pequeno: 65,
      medio: 80,
      grande: 95,
      gigante: 110
    }
  },
  extras: { banho:30, consulta:80, transporte:20, adaptacao:15, treinamento:25 },
  planosCustom: [], // {id, nome, meses, diasMes, descontoPercent, aplica}
  custos: { // Custos operacionais para cálculo de lucro
    hospedagem: { pequeno:25, medio:35, grande:45, gigante:60 },
    creche: { meio:20, integral:35 },
    extras: { banho:10, consulta:30, transporte:8, adaptacao:5, treinamento:10 }
  }
};

// Configurações de comunicação
let configComunicacao = {
  whatsappToken: '',
  whatsappNumero: '',
  smsApiKey: '',
  msgCheckin: 'Olá {cliente}! ✅ Confirmamos o check-in do {pet} para {data}. Estamos ansiosos para receber seu peludo! 🐾',
  msgCheckout: 'Olá {cliente}! 🏠 O {pet} está pronto para o check-out. Pode vir buscar seu peludo! Ele se comportou muito bem! 😊',
  msgLembrete: '🔔 Lembrete: {pet} tem {servico} amanhã ({data}). Não esqueça dos pré-requisitos: cartão de vacinas, coleira antipulgas, caminha e ração!',
  msgSatisfacao: 'Olá {cliente}! Como foi a experiência do {pet} conosco? Por favor, avalie de 1 a 5: ⭐⭐⭐⭐⭐ Sua opinião é muito importante!'
};

// ===== Persistência local =====
const LS_KEY='clubepet-v2';
function saveState(){
  try{ 
    localStorage.setItem(LS_KEY, JSON.stringify({
      clientes,pets,hospedagens,creches,mensagens,avaliacoes,inadimplencias,
      precos,configComunicacao,
      nextClienteId,nextPetId,nextHospedagemId,nextCrecheId,nextMensagemId,nextAvaliacaoId,nextInadimplenciaId
    })); 
  }catch(e){ console.error(e); }
}
// Função para carregar dados da API (substitui localStorage)
async function carregarTodosDados() {
  try {
    console.log('🔄 Carregando todos os dados da API...');
    
    // Carregar dados em paralelo - apenas endpoints que existem
    await Promise.all([
      carregarClientes(),
      carregarPets(),
      carregarHospedagens(),
      carregarCreches()
      // Removidos endpoints que retornam 404:
      // carregarMensagens(),
      // carregarAvaliacoes(), 
      // carregarInadimplencias(),
      // carregarConfiguracoes(),
      // carregarConfiguracoesComunicacao(),
      // carregarPlanosCustomizados()
    ]);
    
    console.log('✅ Todos os dados carregados da API');
    
    // Atualizar interfaces
    atualizarTabelaClientes();
    atualizarTabelaPets();
    atualizarTabelaHospedagem();
    atualizarTabelaCreche();
    atualizarSelectClientes();
    atualizarSelectPets('hospedagemPet');
    atualizarSelectPets('crechePet');
    atualizarSelectPets('galeriaPetSelect');
    
  } catch (error) {
    console.error('❌ Erro ao carregar dados da API:', error);
    // Fallback para localStorage se API falhar
    loadStateFromLocalStorage();
  }
}

// Função de fallback para localStorage
function loadStateFromLocalStorage(){
  try{
    const raw = localStorage.getItem(LS_KEY); if(!raw) return;
    const s = JSON.parse(raw);
    clientes=s.clientes||[]; pets=s.pets||[]; hospedagens=s.hospedagens||[]; creches=s.creches||[];
    mensagens=s.mensagens||[]; avaliacoes=s.avaliacoes||[]; inadimplencias=s.inadimplencias||[];
    precos= s.precos ? {...precos, ...s.precos} : precos;
    configComunicacao = s.configComunicacao ? {...configComunicacao, ...s.configComunicacao} : configComunicacao;
    nextClienteId=s.nextClienteId||1; nextPetId=s.nextPetId||1; nextHospedagemId=s.nextHospedagemId||1; nextCrecheId=s.nextCrecheId||1;
    nextMensagemId=s.nextMensagemId||1; nextAvaliacaoId=s.nextAvaliacaoId||1; nextInadimplenciaId=s.nextInadimplenciaId||1;
  }catch(e){ console.error(e); }
  // garantir novos campos
  if (!Array.isArray(precos.planosCustom)) precos.planosCustom = [];
  if (!precos.custos) precos.custos = { hospedagem: { pequeno:25, medio:35, grande:45, gigante:60 }, creche: { meio:20, integral:35 }, extras: { banho:10, consulta:30, transporte:8, adaptacao:5, treinamento:10 } };
}

// Manter compatibilidade
function loadState() {
  carregarTodosDados();
}

// Função de inicialização do sistema
async function inicializarSistema() {
  console.log('🚀 Inicializando sistema ClubePet...');
  
  try {
    // Carregar todos os dados da API
    await carregarTodosDados();
    
    // Preencher configurações nos formulários
    preencherConfiguracoes();
    preencherConfigComunicacao();
    
    console.log('✅ Sistema inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    // Fallback para localStorage
    loadStateFromLocalStorage();
  }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', inicializarSistema);

// ===== Utilidades Planos Custom =====
function totalDiasPlanoCustom(pl){ return (Number(pl.meses)||0) * (Number(pl.diasMes)||0); }
function getPlanoById(id){ return precos.planosCustom.find(p=>String(p.id)===String(id)); }
function optionsPlanosCustom(aplica){
  return precos.planosCustom.filter(p=> p.aplica==='ambos' || p.aplica===aplica);
}

// ===== Abas =====
function showTab(btn){
  const tabName = btn.dataset.tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b===btn));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id===tabName));
  if(tabName==='pets'){ atualizarSelectClientes(); atualizarSelectPets('galeriaPetSelect'); renderGaleria(); }
  else if(tabName==='hospedagem'){ atualizarSelectPets('hospedagemPet'); popularPlanosEmHospedagem(); calcularPrecoHospedagem(); }
  else if(tabName==='creche'){ atualizarSelectPets('crechePet'); popularPlanosEmCreche(); calcularPrecoCreche(); }
  else if(tabName==='relatorios'){ atualizarResumo(); }
  else if(tabName==='comunicacao'){ atualizarTabelaAvaliacoes(); atualizarResumoSatisfacao(); preencherConfigComunicacao(); }
  else if(tabName==='financeiro'){ atualizarResumoFinanceiro(); atualizarSelectClientesInadimplencia(); atualizarTabelaInadimplencia(); }
  else if(tabName==='configuracoes'){ renderTabelaPlanosCustom(); }
}

// ===== Busca rápida de clientes =====
function buscarClientes(){
  const termo = document.getElementById('buscaClientes').value.toLowerCase().trim();
  const tbody = document.getElementById('tabelaClientes');
  if(!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const texto = row.textContent.toLowerCase();
    if(termo === '' || texto.includes(termo)){
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ===== Busca rápida de pets =====
function buscarPets(){
  const termo = document.getElementById('buscaPets').value.toLowerCase().trim();
  const tbody = document.getElementById('tabelaPets');
  if(!tbody) return;
  
  const rows = tbody.querySelectorAll('tr');
  rows.forEach(row => {
    const texto = row.textContent.toLowerCase();
    if(termo === '' || texto.includes(termo)){
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// ===== API Functions =====

// ===== CLIENTES API =====
async function carregarClientes() {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes`);
    if (response.ok) {
      clientes = await response.json();
      atualizarTabelaClientes();
      atualizarSelectClientes();
    }
  } catch (error) {
    console.error('Erro ao carregar clientes:', error);
  }
}

async function salvarClienteAPI(clienteData) {
  try {
    console.log('🔄 Enviando dados para API:', clienteData);
    
    const response = await fetch(`${API_BASE_URL}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clienteData)
    });
    
    console.log('📡 Resposta da API - Status:', response.status);
    
    if (response.ok) {
      const resultado = await response.json();
      console.log('✅ Cliente salvo com sucesso:', resultado);
      return resultado;
    }
    
    // Tentar obter detalhes do erro da resposta
    let errorMessage = `Erro HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // Se não conseguir parsear o JSON do erro, usar mensagem padrão
      errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
    }
    
    console.error('❌ Erro da API:', errorMessage);
    throw new Error(errorMessage);
    
  } catch (error) {
    console.error('❌ Erro ao conectar com a API:', error);
    
    // Verificar se é erro de rede
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Erro de conexão com a API. Verifique sua internet.');
    }
    
    throw error;
  }
}

async function atualizarClienteAPI(id, clienteData) {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(clienteData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar cliente');
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    throw error;
  }
}

async function excluirClienteAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/clientes/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir cliente');
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    throw error;
  }
}

// ===== PETS API =====
async function carregarPets() {
  try {
    const response = await fetch(`${API_BASE_URL}/pets`);
    if (response.ok) {
      const petsAPI = await response.json();
      // Converter formato da API para formato local
      pets = petsAPI.map(pet => ({
        ...pet,
        clienteNome: pet.cliente?.nome || '—',
        tamanho: pet.tamanho.charAt(0) + pet.tamanho.slice(1).toLowerCase(),
        temperamento: pet.temperamento.charAt(0) + pet.temperamento.slice(1).toLowerCase(),
        imagens: pet.imagens || [],
        dataCadastro: new Date(pet.dataCadastro).toLocaleDateString('pt-BR')
      }));
      atualizarTabelaPets();
      atualizarSelectPets('hospedagemPet');
      atualizarSelectPets('crechePet');
      preencherPetsEmGaleria();
    }
  } catch (error) {
    console.error('Erro ao carregar pets:', error);
  }
}

async function salvarPetAPI(petData) {
  try {
    console.log('🔄 Enviando dados do pet para API:', petData);
    
    const response = await fetch(`${API_BASE_URL}/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(petData)
    });
    
    console.log('📡 Resposta da API - Status:', response.status);
    
    if (response.ok) {
      const resultado = await response.json();
      console.log('✅ Pet salvo com sucesso:', resultado);
      return resultado;
    }
    
    // Tentar obter detalhes do erro da resposta
    let errorMessage = `Erro HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // Se não conseguir parsear o JSON do erro, usar mensagem padrão
      errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
    }
    
    console.error('❌ Erro da API:', errorMessage);
    throw new Error(errorMessage);
    
  } catch (error) {
    console.error('❌ Erro ao conectar com a API:', error);
    
    // Verificar se é erro de rede
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Erro de conexão com a API. Verifique sua internet.');
    }
    
    throw error;
  }
}

async function atualizarPetAPI(id, petData) {
  try {
    const response = await fetch(`${API_BASE_URL}/pets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(petData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar pet');
  } catch (error) {
    console.error('Erro ao atualizar pet:', error);
    throw error;
  }
}

async function excluirPetAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/pets/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir pet');
  } catch (error) {
    console.error('Erro ao excluir pet:', error);
    throw error;
  }
}

async function salvarImagemPetAPI(petId, imagemData) {
  try {
    const response = await fetch(`${API_BASE_URL}/pets/${petId}/imagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(imagemData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar imagem');
  } catch (error) {
    console.error('Erro ao salvar imagem:', error);
    throw error;
  }
}

async function excluirImagemPetAPI(imagemId) {
  try {
    const response = await fetch(`${API_BASE_URL}/pets/imagens/${imagemId}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir imagem');
  } catch (error) {
    console.error('Erro ao excluir imagem:', error);
    throw error;
  }
}

// ===== HOSPEDAGENS API =====
async function carregarHospedagens() {
  try {
    const response = await fetch(`${API_BASE_URL}/hospedagens`);
    if (response.ok) {
      const hospedagensAPI = await response.json();
      hospedagens = hospedagensAPI.map(h => ({
        ...h,
        clienteNome: h.pet?.cliente?.nome || h.clienteNome,
        petNome: h.pet?.nome || h.petNome,
        checkin: h.checkin.split('T')[0],
        checkout: h.checkout.split('T')[0],
        status: h.status.charAt(0) + h.status.slice(1).toLowerCase(),
        dataCriacao: new Date(h.dataCriacao).toLocaleDateString('pt-BR')
      }));
      atualizarTabelaHospedagem();
    }
  } catch (error) {
    console.error('Erro ao carregar hospedagens:', error);
  }
}

async function salvarHospedagemAPI(hospedagemData) {
  try {
    const response = await fetch(`${API_BASE_URL}/hospedagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hospedagemData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar hospedagem');
  } catch (error) {
    console.error('Erro ao salvar hospedagem:', error);
    throw error;
  }
}

async function atualizarHospedagemAPI(id, hospedagemData) {
  try {
    const response = await fetch(`${API_BASE_URL}/hospedagens/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(hospedagemData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar hospedagem');
  } catch (error) {
    console.error('Erro ao atualizar hospedagem:', error);
    throw error;
  }
}

async function excluirHospedagemAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/hospedagens/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir hospedagem');
  } catch (error) {
    console.error('Erro ao excluir hospedagem:', error);
    throw error;
  }
}

// ===== CRECHES API =====
async function carregarCreches() {
  try {
    const response = await fetch(`${API_BASE_URL}/creches`);
    if (response.ok) {
      const crechesAPI = await response.json();
      creches = crechesAPI.map(c => ({
        ...c,
        clienteNome: c.pet?.cliente?.nome || c.clienteNome,
        petNome: c.pet?.nome || c.petNome,
        data: c.data.split('T')[0],
        status: c.status.charAt(0) + c.status.slice(1).toLowerCase(),
        dataCriacao: new Date(c.dataCriacao).toLocaleDateString('pt-BR')
      }));
      atualizarTabelaCreche();
    }
  } catch (error) {
    console.error('Erro ao carregar creches:', error);
  }
}

async function salvarCrecheAPI(crecheData) {
  try {
    const response = await fetch(`${API_BASE_URL}/creches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crecheData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar creche');
  } catch (error) {
    console.error('Erro ao salvar creche:', error);
    throw error;
  }
}

async function atualizarCrecheAPI(id, crecheData) {
  try {
    const response = await fetch(`${API_BASE_URL}/creches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crecheData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar creche');
  } catch (error) {
    console.error('Erro ao atualizar creche:', error);
    throw error;
  }
}

async function excluirCrecheAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/creches/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir creche');
  } catch (error) {
    console.error('Erro ao excluir creche:', error);
    throw error;
  }
}

// ===== MENSAGENS API =====
async function carregarMensagens() {
  // Endpoint não existe na API - usando dados locais
  console.log('⚠️ Endpoint /mensagens não disponível - usando localStorage');
  return;
}

async function salvarMensagemAPI(mensagemData) {
  try {
    const response = await fetch(`${API_BASE_URL}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mensagemData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar mensagem');
  } catch (error) {
    console.error('Erro ao salvar mensagem:', error);
    throw error;
  }
}

async function atualizarMensagemAPI(id, mensagemData) {
  try {
    const response = await fetch(`${API_BASE_URL}/mensagens/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mensagemData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar mensagem');
  } catch (error) {
    console.error('Erro ao atualizar mensagem:', error);
    throw error;
  }
}

async function excluirMensagemAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/mensagens/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir mensagem');
  } catch (error) {
    console.error('Erro ao excluir mensagem:', error);
    throw error;
  }
}

// ===== AVALIAÇÕES API =====
async function carregarAvaliacoes() {
  // Endpoint não existe na API - usando dados locais
  console.log('⚠️ Endpoint /avaliacoes não disponível - usando localStorage');
  return;
}

async function salvarAvaliacaoAPI(avaliacaoData) {
  try {
    const response = await fetch(`${API_BASE_URL}/avaliacoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(avaliacaoData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar avaliação');
  } catch (error) {
    console.error('Erro ao salvar avaliação:', error);
    throw error;
  }
}

async function atualizarAvaliacaoAPI(id, avaliacaoData) {
  try {
    const response = await fetch(`${API_BASE_URL}/avaliacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(avaliacaoData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar avaliação');
  } catch (error) {
    console.error('Erro ao atualizar avaliação:', error);
    throw error;
  }
}

async function excluirAvaliacaoAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/avaliacoes/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir avaliação');
  } catch (error) {
    console.error('Erro ao excluir avaliação:', error);
    throw error;
  }
}

// ===== INADIMPLÊNCIAS API =====
async function carregarInadimplencias() {
  // Endpoint não existe na API - usando dados locais
  console.log('⚠️ Endpoint /inadimplencias não disponível - usando localStorage');
  return;
}

async function salvarInadimplenciaAPI(inadimplenciaData) {
  try {
    const response = await fetch(`${API_BASE_URL}/inadimplencias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inadimplenciaData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar inadimplência');
  } catch (error) {
    console.error('Erro ao salvar inadimplência:', error);
    throw error;
  }
}

async function atualizarInadimplenciaAPI(id, inadimplenciaData) {
  try {
    const response = await fetch(`${API_BASE_URL}/inadimplencias/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inadimplenciaData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao atualizar inadimplência');
  } catch (error) {
    console.error('Erro ao atualizar inadimplência:', error);
    throw error;
  }
}

async function excluirInadimplenciaAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/inadimplencias/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir inadimplência');
  } catch (error) {
    console.error('Erro ao excluir inadimplência:', error);
    throw error;
  }
}

// ===== CONFIGURAÇÕES API =====
async function carregarConfiguracoes() {
  // Endpoint não existe na API - usando dados locais
  console.log('⚠️ Endpoint /configuracoes não disponível - usando localStorage');
  return;
}

async function salvarConfiguracoes() {
  try {
    const configData = {
      precoHospedagemPequeno: parseFloat(document.getElementById('precoHospedagemPequeno').value),
      precoHospedagemMedio: parseFloat(document.getElementById('precoHospedagemMedio').value),
      precoHospedagemGrande: parseFloat(document.getElementById('precoHospedagemGrande').value),
      precoHospedagemGigante: parseFloat(document.getElementById('precoHospedagemGigante').value),
      precoCrecheMeioPequeno: parseFloat(document.getElementById('precoCrecheMeioPequeno').value),
      precoCrecheMeioMedio: parseFloat(document.getElementById('precoCrecheMeioMedio').value),
      precoCrecheMeioGrande: parseFloat(document.getElementById('precoCrecheMeioGrande').value),
      precoCrecheMeioGigante: parseFloat(document.getElementById('precoCrecheMeioGigante').value),
      precoCrecheIntegralPequeno: parseFloat(document.getElementById('precoCrecheIntegralPequeno').value),
      precoCrecheIntegralMedio: parseFloat(document.getElementById('precoCrecheIntegralMedio').value),
      precoCrecheIntegralGrande: parseFloat(document.getElementById('precoCrecheIntegralGrande').value),
      precoCrecheIntegralGigante: parseFloat(document.getElementById('precoCrecheIntegralGigante').value)
    };

    const response = await fetch(`${API_BASE_URL}/configuracoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });

    if (response.ok) {
      await carregarConfiguracoes();
      alert('Configurações salvas com sucesso!');
    } else {
      throw new Error('Erro ao salvar configurações');
    }
  } catch (error) {
    console.error('Erro ao salvar configurações:', error);
    alert('Erro ao salvar configurações. Tente novamente.');
  }
}

async function carregarConfiguracoesComunicacao() {
  // Endpoint não existe na API - usando dados locais
  console.log('⚠️ Endpoint /configuracoes-comunicacao não disponível - usando localStorage');
  return;
}

async function salvarConfiguracoesComunicacao() {
  try {
    const configData = {
      whatsappToken: document.getElementById('whatsappToken').value,
      whatsappNumero: document.getElementById('whatsappNumero').value,
      smsApiKey: document.getElementById('smsApiKey').value,
      msgCheckin: document.getElementById('msgCheckin').value,
      msgCheckout: document.getElementById('msgCheckout').value,
      msgLembrete: document.getElementById('msgLembrete').value,
      msgSatisfacao: document.getElementById('msgSatisfacao').value
    };

    const response = await fetch(`${API_BASE_URL}/configuracoes-comunicacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });

    if (response.ok) {
      configComunicacao = await response.json();
      alert('Configurações de comunicação salvas com sucesso!');
    } else {
      throw new Error('Erro ao salvar configurações');
    }
  } catch (error) {
    console.error('Erro ao salvar configurações de comunicação:', error);
    alert('Erro ao salvar configurações. Tente novamente.');
  }
}

// ===== PLANOS CUSTOMIZADOS API =====
async function carregarPlanosCustomizados() {
  // Endpoint não existe na API - usando dados locais
  console.log('⚠️ Endpoint /planos-customizados não disponível - usando localStorage');
  return;
}

async function salvarPlanoCustomizadoAPI(planoData) {
  try {
    const response = await fetch(`${API_BASE_URL}/planos-customizados`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planoData)
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Erro ao salvar plano');
  } catch (error) {
    console.error('Erro ao salvar plano:', error);
    throw error;
  }
}

async function excluirPlanoCustomizadoAPI(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/planos-customizados/${id}`, {
      method: 'DELETE'
    });
    if (response.ok) {
      return true;
    }
    throw new Error('Erro ao excluir plano');
  } catch (error) {
    console.error('Erro ao excluir plano:', error);
    throw error;
  }
}

// ===== Clientes =====
async function adicionarCliente(){
  const nome = document.getElementById('clienteNome')?.value?.trim();
  const email = document.getElementById('clienteEmail')?.value?.trim();
  const telefone = document.getElementById('clienteTelefone')?.value?.trim();
  const cpf = document.getElementById('clienteCpf')?.value?.trim();
  const endereco = document.getElementById('clienteEndereco')?.value?.trim();
  const emergencia = document.getElementById('clienteEmergencia')?.value?.trim();
  
  if(!nome || !telefone){ 
    alert('Nome e telefone são obrigatórios!'); 
    return; 
  }
  
  // Verificar se email já existe (se preenchido)
  if(email && clientes.some(c => c.email === email)) {
    alert('❌ Este email já está cadastrado para outro cliente!');
    return;
  }
  
  // Verificar se CPF já existe (se preenchido)
  if(cpf && clientes.some(c => c.cpf === cpf)) {
    alert('❌ Este CPF já está cadastrado para outro cliente!');
    return;
  }
  
  try {
    const clienteData = { 
      nome: nome, 
      telefone: telefone,
      // Campos opcionais: enviar null se estiverem vazios para evitar conflitos de unique constraint
      email: email && email.trim() !== '' ? email : null, 
      cpf: cpf && cpf.trim() !== '' ? cpf : null, 
      endereco: endereco && endereco.trim() !== '' ? endereco : null, 
      emergencia: emergencia && emergencia.trim() !== '' ? emergencia : null 
    };
    
    console.log('Enviando dados do cliente:', clienteData);
    const novoCliente = await salvarClienteAPI(clienteData);
    console.log('Cliente salvo:', novoCliente);
    
    await carregarClientes();
    limparFormularioCliente(); 
    alert('✅ Cliente cadastrado com sucesso!'); 
  } catch (error) {
    console.error('Erro detalhado ao cadastrar cliente:', error);
    alert('❌ Erro ao cadastrar cliente: ' + (error.message || 'Tente novamente.'));
  }
}

function editarCliente(id){
  const cliente = clientes.find(c => c.id === id);
  if(!cliente) return;
  
  // Preencher formulário com dados existentes
  document.getElementById('clienteNome').value = cliente.nome || '';
  document.getElementById('clienteEmail').value = cliente.email || '';
  document.getElementById('clienteTelefone').value = cliente.telefone || '';
  document.getElementById('clienteCpf').value = cliente.cpf || '';
  document.getElementById('clienteEndereco').value = cliente.endereco || '';
  document.getElementById('clienteEmergencia').value = cliente.emergencia || '';
  
  // Mudar botão para modo edição
  const btn = document.querySelector('button[onclick="adicionarCliente()"]');
  btn.textContent = '💾 Salvar Alterações';
  btn.onclick = () => salvarEdicaoCliente(id);
}

async function salvarEdicaoCliente(id){
  const nome = document.getElementById('clienteNome').value.trim();
  const email = document.getElementById('clienteEmail').value.trim();
  const telefone = document.getElementById('clienteTelefone').value.trim();
  const cpf = document.getElementById('clienteCpf').value.trim();
  const endereco = document.getElementById('clienteEndereco').value.trim();
  const emergencia = document.getElementById('clienteEmergencia').value.trim();
  
  if(!nome || !telefone){ 
    alert('Nome e telefone são obrigatórios!'); 
    return; 
  }
  
  try {
    const clienteData = { 
      nome, 
      email, 
      telefone, 
      cpf, 
      endereco, 
      emergencia 
    };
    
    await atualizarClienteAPI(id, clienteData);
    await carregarClientes();
    limparFormularioCliente();
    
    // Restaurar botão
    const btn = document.querySelector('button[onclick*="salvarEdicaoCliente"]');
    btn.textContent = '➕ Adicionar Cliente';
    btn.onclick = adicionarCliente;
    
    alert('Cliente atualizado com sucesso!');
  } catch (error) {
    alert('Erro ao atualizar cliente. Tente novamente.');
  }
}

function limparFormularioCliente(){ 
  ['clienteNome','clienteEmail','clienteTelefone','clienteCpf','clienteEndereco','clienteEmergencia'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  // Restaurar botão se estava em modo edição
  const btn = document.querySelector('button[onclick*="salvarEdicao"]') || document.querySelector('button[onclick="adicionarCliente()"]');
  if(btn){
    btn.textContent = '➕ Adicionar Cliente';
    btn.onclick = adicionarCliente;
  }
}

function atualizarTabelaClientes(){
  const tbody = document.getElementById('tabelaClientes'); if(!tbody) return; tbody.innerHTML='';
  clientes.forEach(c=>{
    const r = tbody.insertRow();
    r.innerHTML = `<td>${c.id}</td><td>${c.nome}</td><td>${c.email}</td><td>${c.telefone}</td><td>${c.cpf||''}</td><td>${c.endereco||''}</td><td>${c.emergencia||''}</td><td>${c.dataCadastro||''}</td>
      <td><button class="btn btn-neutral" onclick="editarCliente(${c.id})">✏️</button><button class="btn btn-danger" onclick="excluirCliente(${c.id})">🗑️</button></td>`;
  });
}

async function excluirCliente(id){ 
  if(!confirm('Excluir este cliente?')) return; 
  try {
    await excluirClienteAPI(id);
    await carregarClientes();
  } catch (error) {
    alert('Erro ao excluir cliente. Tente novamente.');
  }
}

function atualizarSelectClientes(){
  const select = document.getElementById('petCliente'); if(select){
    select.innerHTML = '<option value="">Selecione o cliente</option>';
    clientes.forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.nome; select.appendChild(o); });
  }
}

// ===== Pets =====
async function adicionarPet(){
  const clienteId = document.getElementById('petCliente')?.value;
  const nome = document.getElementById('petNome')?.value?.trim();
  const especie = document.getElementById('petEspecie')?.value;
  const raca = document.getElementById('petRaca')?.value?.trim();
  const tamanho = document.getElementById('petTamanho')?.value;
  const peso = document.getElementById('petPeso')?.value;
  const idade = document.getElementById('petIdade')?.value?.trim();
  const temperamento = document.getElementById('petTemperamento')?.value;
  const castrado = document.getElementById('petCastrado')?.value;
  const medicamentos = document.getElementById('petMedicamentos')?.value?.trim();
  const cartao = document.getElementById('petCartaoVacinaNumero')?.value?.trim();
  const observacoes = document.getElementById('petObservacoes')?.value?.trim();

  if(!clienteId || !nome || !especie || !raca || !tamanho || !temperamento){ 
    alert('Campos obrigatórios: Cliente, Nome, Espécie, Raça, Tamanho e Temperamento.'); 
    return; 
  }
  if(!cartao){ 
    alert('Informe o Nº do Cartão de Vacinas do pet.'); 
    return; 
  }

  try {
    const petData = {
      clienteId: parseInt(clienteId),
      nome: nome || '',
      especie: especie || '',
      raca: raca || '',
      tamanho: tamanho || '',
      peso: peso ? parseFloat(peso) : null,
      idade: idade || '',
      temperamento: temperamento || '',
      castrado: castrado || 'Sim',
      medicamentos: medicamentos || '',
      cartaoVacinaNumero: cartao || '',
      observacoes: observacoes || ''
    };
    
    console.log('Enviando dados do pet:', petData);
    const novoPet = await salvarPetAPI(petData);
    console.log('Pet salvo:', novoPet);
    
    // Salvar foto do cartão de vacina se houver
    const fileInput = document.getElementById('petCartaoVacinaFoto');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          await salvarImagemPetAPI(novoPet.id, {
            nome: file.name,
            src: e.target.result,
            tipo: 'cartao_vacina'
          });
          console.log('Foto do cartão salva com sucesso');
        } catch (error) {
          console.error('Erro ao salvar foto do cartão:', error);
        }
      };
      reader.readAsDataURL(file);
    }
    
    await carregarPets();
    limparFormularioPet(); 
    alert('✅ Pet cadastrado com sucesso!'); 
  } catch (error) {
    console.error('Erro detalhado ao cadastrar pet:', error);
    alert('❌ Erro ao cadastrar pet: ' + (error.message || 'Tente novamente.'));
  }
}

function editarPet(id){
  const pet = pets.find(p => p.id === id);
  if(!pet) return;
  
  // Preencher formulário
  document.getElementById('petCliente').value = pet.clienteId || '';
  document.getElementById('petNome').value = pet.nome || '';
  document.getElementById('petEspecie').value = pet.especie || '';
  document.getElementById('petRaca').value = pet.raca || '';
  document.getElementById('petTamanho').value = pet.tamanho || '';
  document.getElementById('petPeso').value = pet.peso || '';
  document.getElementById('petIdade').value = pet.idade || '';
  document.getElementById('petTemperamento').value = pet.temperamento || '';
  document.getElementById('petCastrado').value = pet.castrado || 'Sim';
  document.getElementById('petMedicamentos').value = pet.medicamentos || '';
  document.getElementById('petCartaoVacinaNumero').value = pet.cartaoVacinaNumero || '';
  document.getElementById('petObservacoes').value = pet.observacoes || '';
  
  // Mudar botão para modo edição
  const btn = document.querySelector('button[onclick="adicionarPet()"]');
  btn.textContent = '💾 Salvar Alterações';
  btn.onclick = () => salvarEdicaoPet(id);
}

async function salvarEdicaoPet(id){
  const clienteId = document.getElementById('petCliente').value;
  const nome = document.getElementById('petNome').value.trim();
  const especie = document.getElementById('petEspecie').value;
  const raca = document.getElementById('petRaca').value.trim();
  const tamanho = document.getElementById('petTamanho').value;
  const peso = document.getElementById('petPeso').value;
  const idade = document.getElementById('petIdade').value.trim();
  const temperamento = document.getElementById('petTemperamento').value;
  const castrado = document.getElementById('petCastrado').value;
  const medicamentos = document.getElementById('petMedicamentos').value.trim();
  const cartao = document.getElementById('petCartaoVacinaNumero').value.trim();
  const observacoes = document.getElementById('petObservacoes').value.trim();

  if(!clienteId || !nome || !especie || !raca || !tamanho || !temperamento){ 
    alert('Campos obrigatórios: Cliente, Nome, Espécie, Raça, Tamanho e Temperamento.'); 
    return; 
  }
  if(!cartao){ 
    alert('Informe o Nº do Cartão de Vacinas do pet.'); 
    return; 
  }

  try {
    const petData = {
      clienteId: parseInt(clienteId),
      nome: nome || '',
      especie: especie || '',
      raca: raca || '',
      tamanho: tamanho || '',
      peso: peso ? parseFloat(peso) : null,
      idade: idade || '',
      temperamento: temperamento || '',
      castrado: castrado || 'Sim',
      medicamentos: medicamentos || '',
      cartaoVacinaNumero: cartao || '',
      observacoes: observacoes || ''
    };
    
    await atualizarPetAPI(id, petData);
    await carregarPets();
    limparFormularioPet();
    
    alert('Pet atualizado com sucesso!');
  } catch (error) {
    alert('Erro ao atualizar pet. Tente novamente.');
  }
}

function limparFormularioPet(){ 
  ['petCliente','petNome','petEspecie','petRaca','petTamanho','petPeso','petIdade','petTemperamento','petCastrado','petMedicamentos','petCartaoVacinaNumero','petObservacoes'].forEach(id=>{ 
    const el = document.getElementById(id); 
    if(!el) return; 
    if(el.tagName === 'SELECT') el.selectedIndex = 0; 
    else el.value = ''; 
  }); 
  
  const castradoEl = document.getElementById('petCastrado');
  if(castradoEl) castradoEl.value = 'Sim';
  
  const imagensEl = document.getElementById('petImagensInput');
  if(imagensEl) imagensEl.value = '';
  
  const cartaoFotoEl = document.getElementById('petCartaoVacinaFoto');
  if(cartaoFotoEl) cartaoFotoEl.value = '';
  document.getElementById('petCartaoVacinaFoto').value='';
  document.getElementById('previewCartaoVacina').style.display = 'none';
  
  // Restaurar botão se estava em modo edição
  const btn = document.querySelector('button[onclick*="salvarEdicaoPet"]') || document.querySelector('button[onclick="adicionarPet()"]');
  if(btn){
    btn.textContent = '➕ Adicionar Pet';
    btn.onclick = adicionarPet;
  }
}

function atualizarTabelaPets(){
  const tbody = document.getElementById('tabelaPets'); if(!tbody) return; tbody.innerHTML='';
  pets.forEach(p=>{
    const r = tbody.insertRow();
    r.innerHTML = `
      <td>${p.id}</td><td>${p.clienteNome}</td><td>${p.nome}</td><td>${p.especie}</td><td>${p.raca}</td>
      <td>${p.tamanho}</td><td>${p.peso ? p.peso+'kg' : '-'}</td><td>${p.temperamento}</td>
      <td>${p.cartaoVacinaNumero ? '✅' : '❌'}</td>
      <td>${p.medicamentos ? '✅' : '—'}</td>
      <td>
        <button class="btn btn-neutral" onclick="editarPet(${p.id})">✏️</button>
        <button class="btn btn-neutral" onclick="abrirGaleria(${p.id})">📷</button>
        <button class="btn btn-neutral" onclick="imprimirFichaPet(${p.id})">📄</button>
        <button class="btn btn-danger" onclick="excluirPet(${p.id})">🗑️</button>
      </td>`;
  });
}

async function excluirPet(id){ 
  if(!confirm('Excluir este pet?')) return; 
  try {
    await excluirPetAPI(id);
    await carregarPets();
  } catch (error) {
    alert('Erro ao excluir pet. Tente novamente.');
  }
}

function atualizarSelectPets(selectId){
  const select = document.getElementById(selectId); if(!select) return;
  select.innerHTML = '<option value="">Selecione o pet</option>';
  pets.forEach(p=>{ const o=document.createElement('option'); o.value=p.id; o.textContent=`${p.nome} (${p.clienteNome})`; select.appendChild(o); });
}

// ===== Galeria de imagens por Pet =====
function preencherPetsEmGaleria(){ atualizarSelectPets('galeriaPetSelect'); }

function abrirGaleria(petId){ 
  const sel=document.getElementById('galeriaPetSelect'); 
  if(sel){ 
    sel.value=String(petId); 
    renderGaleria(); 
    document.querySelector('[data-tab="pets"]').click(); 
  }
}

async function uploadImagensPet(){
  const sel = document.getElementById('galeriaPetSelect'); 
  const files = document.getElementById('petImagensInput').files;
  if(!sel || !sel.value){ alert('Selecione um pet para vincular as imagens.'); return; }
  if(!files || !files.length){ alert('Selecione uma ou mais imagens.'); return; }
  
  const petId = sel.value;
  const toBase64 = f=> new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(f); });
  
  try {
    for(const f of files){ 
      const b64 = await toBase64(f); 
      await salvarImagemPetAPI(petId, {
        nome: f.name,
        src: b64,
        tipo: 'galeria'
      });
    }
    await carregarPets();
    renderGaleria(); 
    document.getElementById('petImagensInput').value='';
    alert('Imagens adicionadas com sucesso!');
  } catch(e) { 
    console.error(e);
    alert('Erro ao salvar imagens. Tente novamente.');
  }
}

function renderGaleria(){
  const sel = document.getElementById('galeriaPetSelect'); const wrap = document.getElementById('galeriaPet'); if(!wrap) return; wrap.innerHTML='';
  const pet = pets.find(p=>String(p.id)===String(sel?.value||'')); if(!pet || !Array.isArray(pet.imagens)) return;
  pet.imagens.forEach((img)=>{
    const div = document.createElement('div'); div.className='thumb';
    div.innerHTML = `<img src="${img.src}" alt="${pet.nome} - ${img.nome}"><button onclick="excluirImagemPet(${pet.id},${img.id})">✕</button>`;
    wrap.appendChild(div);
  });
}

async function excluirImagemPet(petId, imagemId){ 
  if(!confirm('Excluir esta imagem?')) return;
  try {
    await excluirImagemPetAPI(imagemId);
    await carregarPets();
    renderGaleria();
  } catch (error) {
    alert('Erro ao excluir imagem. Tente novamente.');
  }
}

// ===== Gerenciamento da Foto do Cartão de Vacina =====
function processarCartaoVacina() {
  const fileInput = document.getElementById('petCartaoVacinaFoto');
  const file = fileInput.files[0];
  
  if (!file) {
    document.getElementById('previewCartaoVacina').style.display = 'none';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = document.getElementById('cartaoVacinaImg');
    img.src = e.target.result;
    document.getElementById('previewCartaoVacina').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removerCartaoVacina() {
  document.getElementById('petCartaoVacinaFoto').value = '';
  document.getElementById('previewCartaoVacina').style.display = 'none';
}

function salvarCartaoVacinaBase64(pet) {
  const fileInput = document.getElementById('petCartaoVacinaFoto');
  const file = fileInput.files[0];
  
  if (!file) {
    pet.cartaoVacinaFoto = null;
    return Promise.resolve();
  }
  
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      pet.cartaoVacinaFoto = {
        src: e.target.result,
        nome: file.name,
        timestamp: Date.now()
      };
      resolve();
    };
    reader.readAsDataURL(file);
  });
}

// ===== Pré-visualização de imagens do pet =====
function mostrarImagensPet(petId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  if (!petId) return;
  
  const pet = pets.find(p => p.id == petId);
  if (!pet || !pet.imagens || pet.imagens.length === 0) {
    container.innerHTML = '<div style="color:#666;font-size:12px;">Nenhuma imagem do pet</div>';
    return;
  }
  
  const div = document.createElement('div');
  div.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:8px;max-width:300px;';
  
  pet.imagens.slice(0, 4).forEach(img => {
    const thumb = document.createElement('div');
    thumb.style.cssText = 'width:60px;height:60px;border:1px solid #ddd;border-radius:6px;overflow:hidden;';
    thumb.innerHTML = `<img src="${img.src}" style="width:100%;height:100%;object-fit:cover;" alt="${pet.nome}">`;
    div.appendChild(thumb);
  });
  
  if (pet.imagens.length > 4) {
    const more = document.createElement('div');
    more.style.cssText = 'width:60px;height:60px;border:1px solid #ddd;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;font-size:10px;color:#666;';
    more.textContent = `+${pet.imagens.length - 4}`;
    div.appendChild(more);
  }
  
  container.appendChild(div);
}

// ===== Hospedagem =====
function popularPlanosEmHospedagem(){
  const sel = document.getElementById('hospedagemPlano'); if(!sel) return;
  const current = sel.value || 'avulso';
  sel.innerHTML = '<option value="avulso">Avulso</option>';
  optionsPlanosCustom('hospedagem').forEach(p=>{
    const o=document.createElement('option'); o.value = `custom:${p.id}`; o.textContent = `${p.nome} ( ${p.meses}m x ${p.diasMes}d/mês, -${p.descontoPercent}% )`;
    sel.appendChild(o);
  });
  sel.value = current;
}

function calcularPrecoHospedagem(){
  const petId = document.getElementById('hospedagemPet').value;
  const checkin = document.getElementById('hospedagemCheckin').value;
  const checkout = document.getElementById('hospedagemCheckout').value;
  const planoVal = document.getElementById('hospedagemPlano').value;
  
  // Mostrar imagens do pet
  mostrarImagensPet(petId, 'imagensHospedagemPet');
  
  if(!petId){ document.getElementById('precoHospedagem').textContent='💰 Valor Total: R$ 0,00'; return; }
  const pet = pets.find(p=>p.id==petId); if(!pet) return;

  // Dias
  let dias = 1; let planoInfo = null; let descontoPercent=0;
  if(planoVal && planoVal.startsWith('custom:')){
    planoInfo = getPlanoById(planoVal.split(':')[1]);
    dias = planoInfo ? totalDiasPlanoCustom(planoInfo) : 1;
    descontoPercent = planoInfo ? Number(planoInfo.descontoPercent)||0 : 0;
  } else {
    const d1 = new Date(checkin), d2 = new Date(checkout);
    const diff = Math.ceil((d2-d1)/(1000*60*60*24));
    dias = (!isNaN(diff) && diff>0) ? diff : 1;
  }

  let base=0;
  switch((pet.tamanho||'').toLowerCase()){
    case 'pequeno': base=precos.hospedagem.pequeno; break;
    case 'médio': case 'medio': base=precos.hospedagem.medio; break;
    case 'grande': base=precos.hospedagem.grande; break;
    case 'gigante': base=precos.hospedagem.gigante; break;
  }
  let subtotal = base * dias;
  if(document.getElementById('servicoBanho').checked) subtotal += precos.extras.banho;
  if(document.getElementById('servicoConsultaVet').checked) subtotal += precos.extras.consulta;
  if(document.getElementById('servicoTransporte').checked) subtotal += precos.extras.transporte;

  const descontoValor = subtotal * (descontoPercent/100);
  const total = Math.max(0, subtotal - descontoValor);

  const visor = document.getElementById('precoHospedagem');
  const planoTxt = planoInfo ? ` • Plano: ${planoInfo.nome} ( -${descontoPercent}% )` : '';
  visor.textContent = `💰 Valor Total: R$ ${total.toFixed(2).replace('.',',')} (${dias} dia(s)${planoTxt})`;
  return { dias, total, subtotal, descontoPercent, descontoValor, base, planoInfo };
}

function validarPrereqHosp(){ return ['prereqVacina','prereqPulga','prereqCaminha','prereqComida'].every(id=>document.getElementById(id).checked); }

// ===== Verificação de conflitos =====
function verificarConflitosHospedagem(petId, checkin, checkout, hospedagemIdExcluir = null) {
  if (!petId || !checkin || !checkout) return [];
  
  const dataCheckin = new Date(checkin);
  const dataCheckout = new Date(checkout);
  
  const conflitos = hospedagens.filter(h => {
    if (hospedagemIdExcluir && h.id === hospedagemIdExcluir) return false;
    if (h.petId != petId) return false;
    if (h.status === 'Checkout') return false;
    
    const hCheckin = new Date(h.checkin);
    const hCheckout = new Date(h.checkout);
    
    // Verifica sobreposição de datas
    return (dataCheckin <= hCheckout && dataCheckout >= hCheckin);
  });
  
  return conflitos;
}

function verificarConflitosCreche(petId, data, crecheIdExcluir = null) {
  if (!petId || !data) return [];
  
  const dataServico = new Date(data).toDateString();
  
  const conflitos = creches.filter(c => {
    if (crecheIdExcluir && c.id === crecheIdExcluir) return false;
    if (c.petId != petId) return false;
    if (c.status === 'Finalizado') return false;
    
    return new Date(c.data).toDateString() === dataServico;
  });
  
  return conflitos;
}

async function adicionarHospedagem(){
  const petId = document.getElementById('hospedagemPet').value;
  const checkin = document.getElementById('hospedagemCheckin').value;
  const checkout = document.getElementById('hospedagemCheckout').value;
  const planoVal = document.getElementById('hospedagemPlano').value;
  if(!petId){ alert('Selecione o Pet.'); return; }
  const pet = pets.find(p=>p.id==petId); const cliente = pet?clientes.find(c=>c.id==pet.clienteId):null;
  if(!pet || !cliente){ alert('Cliente/Pet não encontrados.'); return; }
  
  // Verificar conflitos de data
  const conflitos = verificarConflitosHospedagem(petId, checkin, checkout);
  if (conflitos.length > 0) {
    const conflitosTexto = conflitos.map(c => `ID ${c.id}: ${new Date(c.checkin).toLocaleDateString('pt-BR')} - ${new Date(c.checkout).toLocaleDateString('pt-BR')}`).join('\n');
    alert(`❌ CONFLITO DETECTADO!\n\nO pet ${pet.nome} já possui hospedagem(ns) agendada(s) para este período:\n\n${conflitosTexto}\n\nPor favor, escolha outras datas.`);
    return;
  }
  
  if(!validarPrereqHosp()){ alert('Marque todos os pré-requisitos (cartão, antipulgas, caminha e comida).'); return; }
  const calc = calcularPrecoHospedagem(); if(!calc){ alert('Revise os campos para calcular o valor.'); return; }
  const servicos = []; if(document.getElementById('servicoBanho').checked) servicos.push('Banho');
  if(document.getElementById('servicoConsultaVet').checked) servicos.push('Consulta Veterinária');
  if(document.getElementById('servicoTransporte').checked) servicos.push('Transporte');
  const planoNome = calc.planoInfo ? calc.planoInfo.nome : 'Avulso';
  
  try {
    const hospedagemData = { 
      petId: parseInt(petId), petNome: pet.nome, clienteNome: cliente.nome,
      checkin, checkout, dias: calc.dias, servicos: servicos.join(', '),
      subtotal: calc.subtotal, descontoPercent: calc.descontoPercent, total: calc.total, plano: planoNome
    };
    
    const novaHospedagem = await salvarHospedagemAPI(hospedagemData);
    await carregarHospedagens(); 
    limparFormularioHospedagem();
    
    // Enviar confirmação automática
    enviarMensagemCheckin(cliente, pet, checkin, 'Hospedagem');
    
    alert(`Hospedagem confirmada! Total: R$ ${novaHospedagem.total.toFixed(2).replace('.',',')}`);
  } catch (error) {
    alert('Erro ao confirmar hospedagem. Tente novamente.');
  }
}

function limparFormularioHospedagem(){
  ['hospedagemPet','hospedagemCheckin','hospedagemCheckout','hospedagemPlano'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value= el.id==='hospedagemPlano' ? 'avulso' : ''; });
  ['servicoBanho','servicoConsultaVet','servicoTransporte','prereqVacina','prereqPulga','prereqCaminha','prereqComida'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=false; });
  document.getElementById('precoHospedagem').textContent='💰 Valor Total: R$ 0,00';
  document.getElementById('imagensHospedagemPet').innerHTML = '';
}

function atualizarTabelaHospedagem(){
  const tbody = document.getElementById('tabelaHospedagem'); if(!tbody) return; tbody.innerHTML='';
  hospedagens.forEach(h=>{
    const r = tbody.insertRow();
    r.innerHTML = `
      <td>${h.id}</td><td>${h.petNome}</td><td>${h.clienteNome}</td>
      <td>${h.checkin ? new Date(h.checkin).toLocaleDateString('pt-BR') : '-'}</td>
      <td>${h.checkout ? new Date(h.checkout).toLocaleDateString('pt-BR') : '-'}</td>
      <td>${h.dias}</td><td>${h.servicos || '-'}</td>
      <td>R$ ${Number(h.total).toFixed(2).replace('.',',')}</td>
      <td><span class="status-badge status-${(h.status||'').toLowerCase()}">${h.status}</span></td>
      <td>
        <button class="btn btn-neutral" onclick="gerarOrcamentoHospedagemExistente(${h.id})">🧾</button>
        <button class="btn btn-info" onclick="gerarComprovanteHospedagem(${h.id})" title="Comprovante de Recebimento">📋</button>
        <button class="btn btn-success" onclick="checkout(${h.id})">🏁</button>
        <button class="btn btn-danger" onclick="excluirHospedagem(${h.id})">🗑️</button>
      </td>`;
  });
}

// Função checkout já foi redefinida acima
async function excluirHospedagem(id){ 
  if(!confirm('Excluir esta hospedagem?')) return; 
  try {
    await excluirHospedagemAPI(id);
    await carregarHospedagens();
  } catch (error) {
    alert('Erro ao excluir hospedagem. Tente novamente.');
  }
}

// ===== Creche =====
function popularPlanosEmCreche(){
  const sel = document.getElementById('crechePlano'); if(!sel) return;
  const cur = sel.value || 'avulso';
  sel.innerHTML = '<option value="avulso">Avulso</option>';
  
  // Apenas planos customizados aplicáveis à creche
  optionsPlanosCustom('creche').forEach(p=>{
    const o=document.createElement('option'); 
    o.value = `custom:${p.id}`; 
    o.textContent = `${p.nome} ( ${p.meses}m x ${p.diasMes}d/mês, -${p.descontoPercent}% )`;
    sel.appendChild(o);
  });
  sel.value = cur;
}

function calcularPrecoCreche(){
  const petId = document.getElementById('crechePet').value;
  const periodo = document.getElementById('crechePeriodo').value;
  const planoId = document.getElementById('crechePlano').value;
  
  if(!petId || !periodo) { document.getElementById('precoCreche').textContent='💰 Valor Total: R$ 0,00'; return; }
  
  const pet = pets.find(p=>p.id==petId);
  if(!pet) { document.getElementById('precoCreche').textContent='💰 Valor Total: R$ 0,00'; return; }
  
  const tamanho = pet.tamanho.toLowerCase();
  let base = periodo === 'Meio período' ? precos.creche.meio[tamanho] : precos.creche.integral[tamanho];
  if(!base) base = periodo === 'Meio período' ? precos.creche.meio.medio : precos.creche.integral.medio;

  let multiplicador = 1; let descontoPercent = 0; let planoInfo = null;
  if(planoId && planoId.startsWith('custom:')){
    planoInfo = getPlanoById(planoId.split(':')[1]);
    multiplicador = planoInfo ? totalDiasPlanoCustom(planoInfo) : 1;
    descontoPercent = planoInfo ? Number(planoInfo.descontoPercent)||0 : 0;
  }

  let subtotal = base * multiplicador;
  if(document.getElementById('atividadeAdaptacao').checked){ subtotal += precos.extras.adaptacao * multiplicador; }
  if(document.getElementById('atividadeTreinamento').checked){ subtotal += precos.extras.treinamento * multiplicador; }

  const descontoValor = subtotal * (descontoPercent / 100);
  const total = Math.max(0, subtotal - descontoValor);

  const visor = document.getElementById('precoCreche');
  const planoTxt = planoInfo ? ` • Plano: ${planoInfo.nome} ( -${descontoPercent}% )` : '';
  let sufixo = '';
  if (multiplicador > 1 && descontoPercent) sufixo = ` (${multiplicador} dia(s) • -${descontoPercent}%)`;
  else if (multiplicador > 1) sufixo = ` (${multiplicador} dia(s))`;
  else if (descontoPercent) sufixo = ` (-${descontoPercent}%)`;
  visor.textContent = `💰 Valor Total: R$ ${total.toFixed(2).replace('.',',')}${sufixo}${planoTxt}`;

  return { total, multiplicador, base, periodo, descontoPercent, descontoValor, subtotal, planoInfo };
}

function validarPrereqCreche(){ return ['prereqVacinaC','prereqPulgaC','prereqCaminhaC','prereqComidaC'].every(id=>document.getElementById(id).checked); }

async function adicionarCreche(){
  const petId = document.getElementById('crechePet').value;
  const data = document.getElementById('crecheData').value;
  const periodo = document.getElementById('crechePeriodo').value;
  const planoId = document.getElementById('crechePlano').value;
  const entrada = document.getElementById('crecheEntrada').value;
  const saida = document.getElementById('crecheSaida').value;

  if(!petId || !data || !periodo){ alert('Pet, data e período são obrigatórios!'); return; }
  
  const pet = pets.find(p=>p.id==petId); const cliente = pet?clientes.find(c=>c.id==pet.clienteId):null;
  if(!pet || !cliente){ alert('Cliente/Pet não encontrados.'); return; }
  
  // Verificar conflitos de data
  const conflitos = verificarConflitosCreche(petId, data);
  if (conflitos.length > 0) {
    const conflitosTexto = conflitos.map(c => `ID ${c.id}: ${new Date(c.data).toLocaleDateString('pt-BR')} - ${c.periodo}`).join('\n');
    alert(`❌ CONFLITO DETECTADO!\n\nO pet ${pet.nome} já possui creche agendada para esta data:\n\n${conflitosTexto}\n\nPor favor, escolha outra data.`);
    return;
  }
  
  if(!validarPrereqCreche()){ alert('Marque todos os pré-requisitos (cartão, antipulgas, caminha e comida).'); return; }

  const calc = calcularPrecoCreche(); if(!calc){ alert('Revise os campos para calcular o valor.'); return; }

  const atividades = []; if(document.getElementById('atividadeAdaptacao').checked) atividades.push('Adaptação');
  if(document.getElementById('atividadeTreinamento').checked) atividades.push('Treinamento');

  const planoNome = calc.planoInfo ? calc.planoInfo.nome : 'Avulso';

  try {
    const crecheData = {
      petId: parseInt(petId),
      petNome: pet.nome,
      clienteNome: cliente.nome,
      data, periodo, plano: planoNome, entrada, saida,
      dias: calc.multiplicador,
      atividades: atividades.join(', '),
      subtotal: calc.subtotal,
      descontoPercent: calc.descontoPercent,
      total: calc.total
    };
    
    const novaCreche = await salvarCrecheAPI(crecheData);
    await carregarCreches();
    limparFormularioCreche();
    
    // Enviar confirmação automática
    enviarMensagemCheckin(cliente, pet, data, 'Creche');
    
    alert(`Creche agendada! Total: R$ ${novaCreche.total.toFixed(2).replace('.',',')}`);
  } catch (error) {
    alert('Erro ao agendar creche. Tente novamente.');
  }
}

function limparFormularioCreche(){
  ['crechePet','crecheData','crechePeriodo','crechePlano','crecheEntrada','crecheSaida'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value = (id==='crechePlano'?'avulso':''); });
  ['atividadeAdaptacao','atividadeTreinamento','prereqVacinaC','prereqPulgaC','prereqCaminhaC','prereqComidaC'].forEach(id=>{ const el=document.getElementById(id); if(el) el.checked=false; });
  document.getElementById('precoCreche').textContent='💰 Valor Total: R$ 0,00';
  document.getElementById('imagensCrechePet').innerHTML = '';
}

function atualizarTabelaCreche(){
  const tbody=document.getElementById('tabelaCreche'); if(!tbody) return; tbody.innerHTML='';
  creches.forEach(c=>{
    const r=tbody.insertRow();
    r.innerHTML = `
      <td>${c.id}</td><td>${c.petNome}</td><td>${c.clienteNome}</td>
      <td>${new Date(c.data).toLocaleDateString('pt-BR')}</td>
      <td>${c.periodo}</td><td>${c.plano}</td>
      <td>${c.entrada || '-'}</td><td>${c.saida || '-'}</td>
      <td>${c.atividades || '-'}</td>
      <td>R$ ${Number(c.total).toFixed(2).replace('.',',')}</td>
      <td><span class="status-badge status-${(c.status||'').toLowerCase()}">${c.status}</span></td>
      <td>
        <button class="btn btn-neutral" onclick="gerarOrcamentoCrecheExistente(${c.id})">🧾</button>
        <button class="btn btn-info" onclick="gerarComprovanteCreche(${c.id})" title="Comprovante de Recebimento">📋</button>
        <button class="btn btn-success" onclick="finalizarCreche(${c.id})">✅</button>
        <button class="btn btn-danger" onclick="excluirCreche(${c.id})">🗑️</button>
      </td>`;
  });
}

async function finalizarCreche(id){ 
  try {
    await atualizarCrecheAPI(id, { status: 'FINALIZADO' });
    await carregarCreches();
    alert('Sessão de creche finalizada!');
  } catch (error) {
    alert('Erro ao finalizar creche. Tente novamente.');
  }
}

async function excluirCreche(id){ 
  if(!confirm('Excluir esta sessão de creche?')) return; 
  try {
    await excluirCrecheAPI(id);
    await carregarCreches();
  } catch (error) {
    alert('Erro ao excluir creche. Tente novamente.');
  }
}

// ===== Orçamentos (PDF via Print) =====
function abrirPdfHtml(titulo, corpoHtml) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return; }
  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head>' +
    '<meta charset="utf-8"><title>' + titulo + '</title>' +
    '<style>' +
    '@page{size:A4;margin:16mm}' +
    'body{font-family:Arial,sans-serif;color:#222}' +
    'h1{font-size:20px;margin:0 0 4px}' +
    '.muted{color:#666;font-size:12px}' +
    '.box{border:1px solid #ddd;border-radius:8px;padding:12px;margin:8px 0}' +
    '.row{display:flex;gap:12px}.col{flex:1}' +
    'table{width:100%;border-collapse:collapse;margin-top:8px}' +
    'th,td{border:1px solid #ddd;padding:8px;text-align:left}' +
    'th{background:#f6f6f6}' +
    '.total{font-size:18px;font-weight:700;text-align:right;margin-top:8px}' +
    '.small{font-size:12px;color:#444;line-height:1.4}' +
    '</style>' +
    '</head><body>' + corpoHtml + '</body></html>';
  w.document.open(); w.document.write(html); w.document.close();
  w.onload = () => { try { w.print(); } catch(e){} };
}

function gerarOrcamentoHospedagem(){
  const petId = document.getElementById('hospedagemPet').value;
  const checkin = document.getElementById('hospedagemCheckin').value;
  const checkout = document.getElementById('hospedagemCheckout').value;
  if(!petId){ alert('Selecione Pet.'); return; }
  const pet = pets.find(p=>p.id==petId), cliente = pet?clientes.find(c=>c.id==pet.clienteId):null;
  const calc = calcularPrecoHospedagem(); if(!calc){ alert('Revise os campos para calcular.'); return; }
  const servs = [
    document.getElementById('servicoBanho').checked ? 'Banho' : null,
    document.getElementById('servicoConsultaVet').checked ? 'Consulta Veterinária' : null,
    document.getElementById('servicoTransporte').checked ? 'Transporte' : null
  ].filter(Boolean).join(', ') || '—';
  const hoje = new Date().toLocaleString('pt-BR');
  const planoNome = calc.planoInfo ? calc.planoInfo.nome : 'Avulso';
  const corpo = `
    <h1>Orçamento – Hospedagem (Clube Pet)</h1>
    <div class="muted">Gerado em ${hoje}</div>
    <div class="box">
      <div class="row">
        <div class="col"><strong>Cliente:</strong> ${cliente?cliente.nome:'—'}</div>
        <div class="col"><strong>Telefone:</strong> ${cliente?cliente.telefone:'—'}</div>
      </div>
      <div class="row">
        <div class="col"><strong>Pet:</strong> ${pet?pet.nome:'—'}</div>
        <div class="col"><strong>Tamanho:</strong> ${pet?pet.tamanho:'—'}</div>
      </div>
    </div>
    <div class="box">
      <table>
        <tr><th>Check-in</th><td>${checkin ? new Date(checkin).toLocaleDateString('pt-BR') : '-'}</td></tr>
        <tr><th>Check-out</th><td>${checkout ? new Date(checkout).toLocaleDateString('pt-BR') : '-'}</td></tr>
        <tr><th>Plano</th><td>${planoNome}</td></tr>
        <tr><th>Dias</th><td>${calc.dias}</td></tr>
        <tr><th>Serviços extras</th><td>${servs}</td></tr>
        <tr><th>Subtotal</th><td>R$ ${calc.subtotal.toFixed(2).replace('.',',')}</td></tr>
        <tr><th>Desconto</th><td>${calc.descontoPercent}% (-R$ ${calc.descontoValor.toFixed(2).replace('.',',')})</td></tr>
      </table>
      <div class="total">Total: R$ ${calc.total.toFixed(2).replace('.',',')}</div>
    </div>
    <p class="small"><strong>Pré-requisitos:</strong> cartão de vacinas válido, coleira/antipulgas, caminha e comida.</p>`;
  abrirPdfHtml('Orçamento Hospedagem', corpo);
}

function gerarOrcamentoHospedagemExistente(id){
  const h = hospedagens.find(x=>x.id===id); if(!h){ alert('Reserva não encontrada.'); return; }
  const pet = pets.find(p=>p.id===h.petId); const cliente = pet?clientes.find(c=>c.id===pet.clienteId):null;
  const hoje = new Date().toLocaleString('pt-BR');
  const corpo = `
    <h1>Orçamento – Hospedagem (Clube Pet)</h1>
    <div class="muted">Gerado em ${hoje}</div>
    <div class="box">
      <div class="row">
        <div class="col"><strong>Cliente:</strong> ${cliente?cliente.nome:'—'}</div>
        <div class="col"><strong>Telefone:</strong> ${cliente?cliente.telefone:'—'}</div>
      </div>
      <div class="row">
        <div class="col"><strong>Pet:</strong> ${h.petNome}</div>
        <div class="col"><strong>Plano:</strong> ${h.plano||'Avulso'}</div>
      </div>
    </div>
    <div class="box">
      <table>
        <tr><th>Check-in</th><td>${h.checkin ? new Date(h.checkin).toLocaleDateString('pt-BR') : '-'}</td></tr>
        <tr><th>Check-out</th><td>${h.checkout ? new Date(h.checkout).toLocaleDateString('pt-BR') : '-'}</td></tr>
        <tr><th>Dias</th><td>${h.dias}</td></tr>
        <tr><th>Serviços extras</th><td>${h.servicos || '—'}</td></tr>
        <tr><th>Subtotal</th><td>R$ ${Number(h.subtotal||h.total).toFixed(2).replace('.',',')}</td></tr>
        <tr><th>Desconto</th><td>${Number(h.descontoPercent||0)}%</td></tr>
      </table>
      <div class="total">Total: R$ ${Number(h.total).toFixed(2).replace('.',',')}</div>
    </div>
    <p class="small"><strong>Pré-requisitos:</strong> cartão de vacinas válido, coleira/antipulgas, caminha e comida.</p>`;
  abrirPdfHtml('Orçamento Hospedagem', corpo);
}

function gerarOrcamentoCreche(){
  const petId = document.getElementById('crechePet').value;
  const data = document.getElementById('crecheData').value;
  const periodo = document.getElementById('crechePeriodo').value;
  const planoVal = document.getElementById('crechePlano').value;
  if(!petId || !data || !periodo){ alert('Pet, data e período são obrigatórios!'); return; }
  const pet = pets.find(p=>p.id==petId); const cliente = pet?clientes.find(c=>c.id==pet.clienteId):null;
  const calc = calcularPrecoCreche(); if(!calc){ alert('Revise os campos para calcular.'); return; }
  const atv = [
    document.getElementById('atividadeAdaptacao').checked ? 'Adaptação' : null,
    document.getElementById('atividadeTreinamento').checked ? 'Treinamento' : null
  ].filter(Boolean).join(', ') || '—';
  const hoje = new Date().toLocaleString('pt-BR');
  const planoNome = calc.planoInfo ? calc.planoInfo.nome : 'Avulso';
  const corpo = `
  <h1>Orçamento – Creche (Clube Pet)</h1>
  <div class="muted">Gerado em ${hoje}</div>
  <div class="box">
    <div class="row">
      <div class="col"><strong>Cliente:</strong> ${cliente?cliente.nome:'—'}</div>
      <div class="col"><strong>Telefone:</strong> ${cliente?cliente.telefone:'—'}</div>
    </div>
    <div class="row">
      <div class="col"><strong>Pet:</strong> ${pet?pet.nome:'—'}</div>
      <div class="col"><strong>Plano:</strong> ${planoNome}</div>
    </div>
  </div>
  <div class="box">
    <table>
      <tr><th>Data inicial</th><td>${new Date(data).toLocaleDateString('pt-BR')}</td></tr>
      <tr><th>Período</th><td>${periodo}</td></tr>
      <tr><th>Dias</th><td>${calc.multiplicador}</td></tr>
      ${calc.descontoPercent ? `<tr><th>Desconto</th><td>${calc.descontoPercent}% (-R$ ${calc.descontoValor.toFixed(2).replace('.',',')})</td></tr>` : ''}
      <tr><th>Subtotal</th><td>R$ ${calc.subtotal.toFixed(2).replace('.',',')}</td></tr>
      <tr><th>Atividades</th><td>${atv}</td></tr>
    </table>
    <div class="total">Total: R$ ${calc.total.toFixed(2).replace('.',',')}</div>
  </div>
  <p class="small"><strong>Pré-requisitos:</strong> cartão de vacinas válido, coleira/antipulgas, caminha e comida.</p>
`;
  abrirPdfHtml('Orçamento Creche', corpo);
}

function gerarOrcamentoCrecheExistente(id){
  const c = creches.find(x=>x.id===id); if(!c){ alert('Registro não encontrado.'); return; }
  const pet = pets.find(p=>p.id===c.petId);
  const cliente = pet ? clientes.find(z=>z.id===pet.clienteId) : null;
  const hoje = new Date().toLocaleString('pt-BR');
  const corpo = `
    <h1>Orçamento – Creche (Clube Pet)</h1>
    <div class="muted">Gerado em ${hoje}</div>
    <div class="box">
      <div class="row">
        <div class="col"><strong>Cliente:</strong> ${cliente?cliente.nome:'—'}</div>
        <div class="col"><strong>Telefone:</strong> ${cliente?cliente.telefone:'—'}</div>
      </div>
      <div class="row">
        <div class="col"><strong>Pet:</strong> ${c.petNome}</div>
        <div class="col"><strong>Plano:</strong> ${c.plano}</div>
      </div>
    </div>
    <div class="box">
      <table>
        <tr><th>Data</th><td>${new Date(c.data).toLocaleDateString('pt-BR')}</td></tr>
        <tr><th>Período</th><td>${c.periodo}</td></tr>
        <tr><th>Dias</th><td>${c.dias}</td></tr>
        <tr><th>Atividades</th><td>${c.atividades || '—'}</td></tr>
        <tr><th>Subtotal</th><td>R$ ${Number(c.subtotal||c.total).toFixed(2).replace('.',',')}</td></tr>
        <tr><th>Desconto</th><td>${Number(c.descontoPercent||0)}%</td></tr>
      </table>
      <div class="total">Total: R$ ${Number(c.total).toFixed(2).replace('.',',')}</div>
    </div>
    <p class="small"><strong>Pré-requisitos:</strong> cartão de vacinas válido, coleira/antipulgas, caminha e comida.</p>`;
  abrirPdfHtml('Orçamento Creche', corpo);
}

// ===== Comprovantes de Recebimento =====
function gerarComprovanteHospedagem(id) {
  const h = hospedagens.find(x => x.id === id);
  if (!h) { alert('Hospedagem não encontrada.'); return; }
  
  const pet = pets.find(p => p.id === h.petId);
  const cliente = pet ? clientes.find(c => c.id === pet.clienteId) : null;
  const agora = new Date().toLocaleString('pt-BR');
  
  const corpo = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #28a745; padding-bottom: 15px;">
        <h1 style="color: #28a745; margin: 0; font-size: 28px;">🐾 CLUBE PET</h1>
        <h2 style="color: #333; margin: 10px 0 0 0; font-size: 20px;">COMPROVANTE DE RECEBIMENTO</h2>
        <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Hospedagem #${h.id}</p>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #28a745; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">✅ Confirmação de Check-in</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Data/Hora:</strong> ${agora}</div>
          <div><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">RECEBIDO</span></div>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🐕 Dados do Pet</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Nome:</strong> ${pet?.nome || '—'}</div>
          <div><strong>Espécie/Raça:</strong> ${pet?.especie || '—'} / ${pet?.raca || '—'}</div>
          <div><strong>Tamanho:</strong> ${pet?.tamanho || '—'}</div>
          <div><strong>Tutor:</strong> ${cliente?.nome || '—'}</div>
          <div><strong>Telefone:</strong> ${cliente?.telefone || '—'}</div>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🏨 Detalhes da Hospedagem</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Check-in:</strong> ${h.checkin ? new Date(h.checkin).toLocaleDateString('pt-BR') : '—'}</div>
          <div><strong>Check-out:</strong> ${h.checkout ? new Date(h.checkout).toLocaleDateString('pt-BR') : '—'}</div>
          <div><strong>Período:</strong> ${h.dias} dia(s)</div>
          <div><strong>Plano:</strong> ${h.plano || 'Avulso'}</div>
          <div><strong>Serviços:</strong> ${h.servicos || 'Nenhum'}</div>
          <div><strong>Valor Total:</strong> <span style="color: #28a745; font-weight: bold;">R$ ${Number(h.total).toFixed(2).replace('.', ',')}</span></div>
        </div>
      </div>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #856404; margin: 0 0 10px 0;">📋 Itens Recebidos</h3>
        <div style="color: #856404; font-size: 14px;">
          <p>✅ Pet entregue em boas condições</p>
          <p>✅ Ração e medicamentos (se aplicável)</p>
          <p>✅ Objetos pessoais (caminha, brinquedos, etc.)</p>
          <p>✅ Documentação (cartão de vacinas)</p>
        </div>
      </div>
      
      <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #0c5460; margin: 0 0 10px 0;">ℹ️ Informações Importantes</h3>
        <div style="color: #0c5460; font-size: 12px; line-height: 1.5;">
          <p>• O pet será cuidado com carinho e atenção durante toda a hospedagem</p>
          <p>• Qualquer emergência será comunicada imediatamente</p>
          <p>• Check-out disponível a partir das 8h no dia agendado</p>
          <p>• Em caso de dúvidas, entre em contato: (11) 99999-9999</p>
        </div>
      </div>
      
      <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p><strong>Clube Pet</strong> - Pet Sector e Hotel</p>
        <p>Emitido em: ${agora}</p>
        <p style="margin-top: 15px; font-style: italic;">Obrigado por confiar em nossos serviços!</p>
      </div>
    </div>
  `;
  
  abrirPdfHtml(`Comprovante de Recebimento - Hospedagem #${h.id}`, corpo);
}

function gerarComprovanteCreche(id) {
  const c = creches.find(x => x.id === id);
  if (!c) { alert('Sessão de creche não encontrada.'); return; }
  
  const pet = pets.find(p => p.id === c.petId);
  const cliente = pet ? clientes.find(cl => cl.id === pet.clienteId) : null;
  const agora = new Date().toLocaleString('pt-BR');
  
  const corpo = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #17a2b8; padding-bottom: 15px;">
        <h1 style="color: #17a2b8; margin: 0; font-size: 28px;">🐾 CLUBE PET</h1>
        <h2 style="color: #333; margin: 10px 0 0 0; font-size: 20px;">COMPROVANTE DE RECEBIMENTO</h2>
        <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Creche #${c.id}</p>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #17a2b8; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">✅ Confirmação de Entrega</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Data/Hora:</strong> ${agora}</div>
          <div><strong>Status:</strong> <span style="color: #17a2b8; font-weight: bold;">RECEBIDO</span></div>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🐕 Dados do Pet</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Nome:</strong> ${pet?.nome || '—'}</div>
          <div><strong>Espécie/Raça:</strong> ${pet?.especie || '—'} / ${pet?.raca || '—'}</div>
          <div><strong>Tamanho:</strong> ${pet?.tamanho || '—'}</div>
          <div><strong>Tutor:</strong> ${cliente?.nome || '—'}</div>
          <div><strong>Telefone:</strong> ${cliente?.telefone || '—'}</div>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #495057; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">🎾 Detalhes da Creche</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Data:</strong> ${new Date(c.data).toLocaleDateString('pt-BR')}</div>
          <div><strong>Período:</strong> ${c.periodo}</div>
          <div><strong>Plano:</strong> ${c.plano}</div>
          <div><strong>Entrada:</strong> ${c.entrada || 'Flexível'}</div>
          <div><strong>Saída:</strong> ${c.saida || 'Flexível'}</div>
          <div><strong>Atividades:</strong> ${c.atividades || 'Padrão'}</div>
          <div><strong>Valor Total:</strong> <span style="color: #17a2b8; font-weight: bold;">R$ ${Number(c.total).toFixed(2).replace('.', ',')}</span></div>
        </div>
      </div>
      
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #856404; margin: 0 0 10px 0;">📋 Itens Recebidos</h3>
        <div style="color: #856404; font-size: 14px;">
          <p>✅ Pet entregue em boas condições</p>
          <p>✅ Ração para o período (se necessário)</p>
          <p>✅ Medicamentos com orientações (se aplicável)</p>
          <p>✅ Objetos pessoais identificados</p>
        </div>
      </div>
      
      <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #155724; margin: 0 0 10px 0;">🎯 Programação do Dia</h3>
        <div style="color: #155724; font-size: 14px; line-height: 1.5;">
          <p><strong>Manhã:</strong> Atividades de socialização e brincadeiras</p>
          <p><strong>Tarde:</strong> Descanso, alimentação e cuidados individuais</p>
          <p><strong>Atividades extras:</strong> ${c.atividades || 'Conforme necessidade do pet'}</p>
        </div>
      </div>
      
      <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #0c5460; margin: 0 0 10px 0;">ℹ️ Informações Importantes</h3>
        <div style="color: #0c5460; font-size: 12px; line-height: 1.5;">
          <p>• Seu pet será acompanhado por profissionais qualificados</p>
          <p>• Relatório diário disponível via WhatsApp</p>
          <p>• Busca disponível no horário combinado</p>
          <p>• Em caso de emergência: (11) 99999-9999</p>
        </div>
      </div>
      
      <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p><strong>Clube Pet</strong> - Pet Sector e Hotel</p>
        <p>Emitido em: ${agora}</p>
        <p style="margin-top: 15px; font-style: italic;">Obrigado por confiar em nossos serviços!</p>
      </div>
    </div>
  `;
  
  abrirPdfHtml(`Comprovante de Recebimento - Creche #${c.id}`, corpo);
}

// ===== Relatórios =====
function atualizarResumo(){
  document.getElementById('totalClientes').textContent = clientes.length;
  document.getElementById('totalPets').textContent = pets.length;
  document.getElementById('hospedagensAtivas').textContent = hospedagens.filter(h=>h.status==='Ativo').length;
  
  const hoje = new Date();
  const mesAtual = hospedagens.concat(creches).filter(item => {
    const data = new Date(item.dataCriacao || item.data);
    return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear();
  });
  
  const faturamento = mesAtual.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  document.getElementById('faturamentoMensal').textContent = `R$ ${faturamento.toFixed(2).replace('.',',')}`;
}

function gerarRelatorio(){
  const periodo = document.getElementById('relatorioPeriodo').value;
  const inicio = document.getElementById('relatorioInicio').value;
  const fim = document.getElementById('relatorioFim').value;
  
  let filteredHospedagens = [...hospedagens];
  let filteredCreches = [...creches];
  
  if (periodo === 'personalizado' && inicio && fim) {
    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);
    
    filteredHospedagens = hospedagens.filter(h => {
      const data = new Date(h.checkin || h.dataCriacao);
      return data >= dataInicio && data <= dataFim;
    });
    
    filteredCreches = creches.filter(c => {
      const data = new Date(c.data);
      return data >= dataInicio && data <= dataFim;
    });
  } else if (periodo !== 'personalizado') {
    const hoje = new Date();
    let dataLimite;
    
    if (periodo === 'hoje') {
      dataLimite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    } else if (periodo === 'semana') {
      dataLimite = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periodo === 'mes') {
      dataLimite = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }
    
    if (dataLimite) {
      filteredHospedagens = hospedagens.filter(h => {
        const data = new Date(h.checkin || h.dataCriacao);
        return data >= dataLimite;
      });
      
      filteredCreches = creches.filter(c => {
        const data = new Date(c.data);
        return data >= dataLimite;
      });
    }
  }
  
  const relatorioDiv = document.getElementById('relatorioResultado');
  const tbody = document.getElementById('tabelaRelatorio');
  
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  // Resumo hospedagens
  const totalHospedagens = filteredHospedagens.length;
  const receitaHospedagens = filteredHospedagens.reduce((sum, h) => sum + (Number(h.total) || 0), 0);
  
  // Resumo creches
  const totalCreches = filteredCreches.length;
  const receitaCreches = filteredCreches.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
  
  // Adicionar linhas ao relatório
  const rowHospedagem = tbody.insertRow();
  rowHospedagem.innerHTML = `
    <td>Hospedagens</td>
    <td>${totalHospedagens}</td>
    <td>R$ ${receitaHospedagens.toFixed(2).replace('.', ',')}</td>
  `;
  
  const rowCreche = tbody.insertRow();
  rowCreche.innerHTML = `
    <td>Creche</td>
    <td>${totalCreches}</td>
    <td>R$ ${receitaCreches.toFixed(2).replace('.', ',')}</td>
  `;
  
  const rowTotal = tbody.insertRow();
  rowTotal.innerHTML = `
    <td><strong>TOTAL</strong></td>
    <td><strong>${totalHospedagens + totalCreches}</strong></td>
    <td><strong>R$ ${(receitaHospedagens + receitaCreches).toFixed(2).replace('.', ',')}</strong></td>
  `;
  
  relatorioDiv.style.display = 'block';
}

// ===== XLSX Export Functions =====
function exportarExcel(){
  if (!window.ExcelJS) {
    alert('Biblioteca ExcelJS não carregada. Tente novamente em alguns segundos.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Clube Pet';
  workbook.created = new Date();

  // Aba Resumo
  const resumo = workbook.addWorksheet('Resumo');
  resumo.columns = [
    { header: 'Métrica', key: 'metrica', width: 25 },
    { header: 'Valor', key: 'valor', width: 15 }
  ];

  resumo.addRows([
    { metrica: 'Total de Clientes', valor: clientes.length },
    { metrica: 'Total de Pets', valor: pets.length },
    { metrica: 'Hospedagens Ativas', valor: hospedagens.filter(h=>h.status==='Ativo').length },
    { metrica: 'Total de Hospedagens', valor: hospedagens.length },
    { metrica: 'Total de Sessões de Creche', valor: creches.length },
  ]);

  // Aba Clientes
  const clientesWs = workbook.addWorksheet('Clientes');
  clientesWs.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Telefone', key: 'telefone', width: 20 },
    { header: 'CPF', key: 'cpf', width: 20 },
    { header: 'Endereço', key: 'endereco', width: 40 },
    { header: 'Emergência', key: 'emergencia', width: 30 },
    { header: 'Data Cadastro', key: 'dataCadastro', width: 15 }
  ];
  clientesWs.addRows(clientes);

  // Aba Pets
  const petsWs = workbook.addWorksheet('Pets');
  petsWs.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Cliente', key: 'clienteNome', width: 25 },
    { header: 'Nome', key: 'nome', width: 20 },
    { header: 'Espécie', key: 'especie', width: 15 },
    { header: 'Raça', key: 'raca', width: 20 },
    { header: 'Tamanho', key: 'tamanho', width: 15 },
    { header: 'Peso', key: 'peso', width: 10 },
    { header: 'Idade', key: 'idade', width: 15 },
    { header: 'Temperamento', key: 'temperamento', width: 20 },
    { header: 'Castrado', key: 'castrado', width: 15 },
    { header: 'Cartão Vacina', key: 'cartaoVacinaNumero', width: 20 },
    { header: 'Data Cadastro', key: 'dataCadastro', width: 15 }
  ];
  petsWs.addRows(pets);

  // Aba Hospedagens
  const hospedagensWs = workbook.addWorksheet('Hospedagens');
  hospedagensWs.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Pet', key: 'petNome', width: 20 },
    { header: 'Cliente', key: 'clienteNome', width: 25 },
    { header: 'Check-in', key: 'checkin', width: 15 },
    { header: 'Check-out', key: 'checkout', width: 15 },
    { header: 'Dias', key: 'dias', width: 10 },
    { header: 'Plano', key: 'plano', width: 20 },
    { header: 'Serviços', key: 'servicos', width: 30 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
    { header: 'Desconto %', key: 'descontoPercent', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Data Criação', key: 'dataCriacao', width: 15 }
  ];
  hospedagensWs.addRows(hospedagens);

  // Aba Creches
  const crechesWs = workbook.addWorksheet('Creches');
  crechesWs.columns = [
    { header: 'ID', key: 'id', width: 10 },
    { header: 'Pet', key: 'petNome', width: 20 },
    { header: 'Cliente', key: 'clienteNome', width: 25 },
    { header: 'Data', key: 'data', width: 15 },
    { header: 'Período', key: 'periodo', width: 20 },
    { header: 'Plano', key: 'plano', width: 20 },
    { header: 'Entrada', key: 'entrada', width: 10 },
    { header: 'Saída', key: 'saida', width: 10 },
    { header: 'Dias', key: 'dias', width: 10 },
    { header: 'Atividades', key: 'atividades', width: 30 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
    { header: 'Desconto %', key: 'descontoPercent', width: 15 },
    { header: 'Total', key: 'total', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Data Criação', key: 'dataCriacao', width: 15 }
  ];
  crechesWs.addRows(creches);

  // Estilizar cabeçalhos
  [resumo, clientesWs, petsWs, hospedagensWs, crechesWs].forEach(ws => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F81BD' }
    };
    ws.getRow(1).font.color = { argb: 'FFFFFFFF' };
  });

  // Processar imagem opcional
  const imgInput = document.getElementById('xlsxImagem');
  if (imgInput && imgInput.files && imgInput.files[0]) {
    const file = imgInput.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const imageId = workbook.addImage({
          base64: e.target.result,
          extension: file.type.split('/')[1] || 'png',
        });
        
        resumo.addImage(imageId, {
          tl: { col: 3, row: 1 },
          ext: { width: 200, height: 100 }
        });
      } catch (err) {
        console.warn('Erro ao processar imagem:', err);
      }
      
      salvarArquivo();
    };
    reader.readAsDataURL(file);
  } else {
    salvarArquivo();
  }

  function salvarArquivo() {
    const hoje = new Date().toISOString().split('T')[0];
    const filename = `ClubePet_Export_${hoje}.xlsx`;
    
    workbook.xlsx.writeBuffer().then(function(buffer) {
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      if (window.saveAs) {
        saveAs(blob, filename);
      } else {
        // Fallback manual
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      alert('Planilha exportada com sucesso!');
    }).catch(function(error) {
      console.error('Erro ao gerar planilha:', error);
      alert('Erro ao gerar planilha. Verifique o console.');
    });
  }
}

function exportarRelatorio() {
  if (!window.ExcelJS) {
    alert('Biblioteca ExcelJS não carregada. Tente novamente em alguns segundos.');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Clube Pet';
  workbook.created = new Date();

  // Aba Relatório Financeiro
  const relatorio = workbook.addWorksheet('Relatório Financeiro');
  
  // Cabeçalho do relatório
  relatorio.mergeCells('A1:D1');
  relatorio.getCell('A1').value = 'RELATÓRIO FINANCEIRO - CLUBE PET';
  relatorio.getCell('A1').font = { size: 16, bold: true };
  relatorio.getCell('A1').alignment = { horizontal: 'center' };
  
  relatorio.getCell('A2').value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
  relatorio.getCell('A2').font = { italic: true };

  // Resumo geral
  relatorio.getCell('A4').value = 'RESUMO GERAL';
  relatorio.getCell('A4').font = { bold: true, size: 14 };
  
  const totalHospedagens = hospedagens.length;
  const totalCreches = creches.length;
  const receitaHospedagens = hospedagens.reduce((sum, h) => sum + (Number(h.total) || 0), 0);
  const receitaCreches = creches.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
  const receitaTotal = receitaHospedagens + receitaCreches;
  
  relatorio.getCell('A5').value = 'Total de Hospedagens:';
  relatorio.getCell('B5').value = totalHospedagens;
  relatorio.getCell('A6').value = 'Receita Hospedagens:';
  relatorio.getCell('B6').value = `R$ ${receitaHospedagens.toFixed(2).replace('.', ',')}`;
  
  relatorio.getCell('A7').value = 'Total de Creches:';
  relatorio.getCell('B7').value = totalCreches;
  relatorio.getCell('A8').value = 'Receita Creches:';
  relatorio.getCell('B8').value = `R$ ${receitaCreches.toFixed(2).replace('.', ',')}`;
  
  relatorio.getCell('A9').value = 'RECEITA TOTAL:';
  relatorio.getCell('B9').value = `R$ ${receitaTotal.toFixed(2).replace('.', ',')}`;
  relatorio.getCell('A9').font = { bold: true };
  relatorio.getCell('B9').font = { bold: true };

  // Detalhamento por mês
  relatorio.getCell('A11').value = 'FATURAMENTO POR MÊS';
  relatorio.getCell('A11').font = { bold: true, size: 14 };
  
  // Coletar dados mensais
  const dadosMensais = {};
  
  hospedagens.forEach(h => {
    const data = new Date(h.checkin || h.dataCriacao);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    if (!dadosMensais[chave]) {
      dadosMensais[chave] = { hospedagens: 0, creches: 0, totalHosp: 0, totalCreche: 0 };
    }
    dadosMensais[chave].hospedagens++;
    dadosMensais[chave].totalHosp += Number(h.total) || 0;
  });
  
  creches.forEach(c => {
    const data = new Date(c.data);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    if (!dadosMensais[chave]) {
      dadosMensais[chave] = { hospedagens: 0, creches: 0, totalHosp: 0, totalCreche: 0 };
    }
    dadosMensais[chave].creches++;
    dadosMensais[chave].totalCreche += Number(c.total) || 0;
  });

  // Cabeçalhos da tabela mensal
  relatorio.getCell('A12').value = 'Mês/Ano';
  relatorio.getCell('B12').value = 'Hospedagens';
  relatorio.getCell('C12').value = 'Creches';
  relatorio.getCell('D12').value = 'Receita Total';
  
  let row = 13;
  Object.keys(dadosMensais).sort().forEach(mes => {
    const dados = dadosMensais[mes];
    const [ano, mesNum] = mes.split('-');
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    relatorio.getCell(`A${row}`).value = `${nomesMeses[parseInt(mesNum) - 1]}/${ano}`;
    relatorio.getCell(`B${row}`).value = `${dados.hospedagens} (R$ ${dados.totalHosp.toFixed(2).replace('.', ',')})`;
    relatorio.getCell(`C${row}`).value = `${dados.creches} (R$ ${dados.totalCreche.toFixed(2).replace('.', ',')})`;
    relatorio.getCell(`D${row}`).value = `R$ ${(dados.totalHosp + dados.totalCreche).toFixed(2).replace('.', ',')}`;
    row++;
  });

  // Estilizar cabeçalhos
  ['A12', 'B12', 'C12', 'D12'].forEach(cell => {
    relatorio.getCell(cell).font = { bold: true };
    relatorio.getCell(cell).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };
  });

  // Ajustar larguras das colunas
  relatorio.getColumn('A').width = 20;
  relatorio.getColumn('B').width = 25;
  relatorio.getColumn('C').width = 25;
  relatorio.getColumn('D').width = 20;

  // Salvar arquivo
  const hoje = new Date().toISOString().split('T')[0];
  const filename = `ClubePet_Relatorio_${hoje}.xlsx`;
  
  workbook.xlsx.writeBuffer().then(function(buffer) {
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    if (window.saveAs) {
      saveAs(blob, filename);
    } else {
      // Fallback manual
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
    
    alert('Relatório exportado com sucesso!');
  }).catch(function(error) {
    console.error('Erro ao gerar relatório:', error);
    alert('Erro ao gerar relatório. Verifique o console.');
  });
}

// ===== Configurações: salvar, preencher e planos custom =====
function salvarConfiguracoes(){
  const n = id => parseFloat(document.getElementById(id)?.value) || 0;

  // Hospedagem
  precos.hospedagem = {
    pequeno: n('precoHospedagemPequeno'),
    medio:   n('precoHospedagemMedio'),
    grande:  n('precoHospedagemGrande'),
    gigante: n('precoHospedagemGigante'),
  };

  // Creche (diárias)
  precos.creche = { meio: n('precoCrecheMeio'), integral: n('precoCrecheIntegral') };

  saveState();
  alert('Configurações salvas!');
  popularPlanosEmHospedagem();
  popularPlanosEmCreche();
  calcularPrecoHospedagem();
  calcularPrecoCreche();
}

function preencherConfiguracoes(){
  const set = (id,val)=>{ const el=document.getElementById(id); if(el!=null && val!=null) el.value = String(val); };

  // Hospedagem
  set('precoHospedagemPequeno', precos.hospedagem.pequeno);
  set('precoHospedagemMedio',   precos.hospedagem.medio);
  set('precoHospedagemGrande',  precos.hospedagem.grande);
  set('precoHospedagemGigante', precos.hospedagem.gigante);

  // Creche - Meio período
  set('precoCrecheMeioPequeno', precos.creche.meio.pequeno);
  set('precoCrecheMeioMedio', precos.creche.meio.medio);
  set('precoCrecheMeioGrande', precos.creche.meio.grande);
  set('precoCrecheMeioGigante', precos.creche.meio.gigante);
  
  // Creche - Período integral
  set('precoCrecheIntegralPequeno', precos.creche.integral.pequeno);
  set('precoCrecheIntegralMedio', precos.creche.integral.medio);
  set('precoCrecheIntegralGrande', precos.creche.integral.grande);
  set('precoCrecheIntegralGigante', precos.creche.integral.gigante);

  renderTabelaPlanosCustom();
}

// --- Planos custom CRUD ---
function adicionarPlanoCustom(){
  const nome = document.getElementById('customPlanoNome').value.trim();
  const meses = parseInt(document.getElementById('customPlanoMeses').value)||0;
  const diasMes = parseInt(document.getElementById('customPlanoDiasMes').value)||0;
  const descontoPercent = parseFloat(document.getElementById('customPlanoDesconto').value)||0;
  const aplica = document.getElementById('customPlanoAplica').value;
  if(!nome || meses<=0 || diasMes<=0){ alert('Preencha nome, meses e dias/mês com valores válidos.'); return; }
  const id = Date.now();
  precos.planosCustom.push({id, nome, meses, diasMes, descontoPercent, aplica});
  saveState();
  renderTabelaPlanosCustom();
  popularPlanosEmHospedagem();
  popularPlanosEmCreche();
  
  // Limpar formulário
  document.getElementById('customPlanoNome').value = '';
  document.getElementById('customPlanoMeses').value = '12';
  document.getElementById('customPlanoDiasMes').value = '';
  document.getElementById('customPlanoDesconto').value = '0';
  document.getElementById('customPlanoAplica').value = 'ambos';
  
  alert('Plano adicionado!');
}

function removerPlanoCustom(id){
  if(!confirm('Remover este plano customizado?')) return;
  precos.planosCustom = precos.planosCustom.filter(p=>String(p.id)!==String(id));
  saveState(); renderTabelaPlanosCustom(); popularPlanosEmHospedagem(); popularPlanosEmCreche();
  alert('Plano removido!');
}

function renderTabelaPlanosCustom(){
  const tbody = document.getElementById('tabelaPlanosCustom'); if(!tbody) return; tbody.innerHTML='';
  precos.planosCustom.forEach(p=>{
    const r = tbody.insertRow();
    r.innerHTML = `<td>${p.nome}</td><td>${p.meses}</td><td>${p.diasMes}</td><td>${totalDiasPlanoCustom(p)}</td><td>${p.descontoPercent}%</td><td>${p.aplica}</td><td><button class="btn btn-danger" onclick="removerPlanoCustom(${p.id})">🗑️</button></td>`;
  });
}

// ===== Sistema de Comunicação =====
async function enviarMensagemCheckin(cliente, pet, data, servico) {
  if (!configComunicacao.whatsappToken && !configComunicacao.smsApiKey) {
    console.log('Configurações de comunicação não definidas');
    return;
  }
  
  let mensagem = configComunicacao.msgCheckin;
  mensagem = mensagem.replace('{cliente}', cliente.nome);
  mensagem = mensagem.replace('{pet}', pet.nome);
  mensagem = mensagem.replace('{data}', new Date(data).toLocaleDateString('pt-BR'));
  mensagem = mensagem.replace('{servico}', servico);
  
  try {
    const mensagemData = {
      clienteId: cliente.id,
      petId: pet.id,
      tipo: 'Check-in',
      mensagem,
      status: 'Enviada'
    };
    
    await salvarMensagemAPI(mensagemData);
    console.log(`📱 Mensagem enviada para ${cliente.telefone}: ${mensagem}`);
  } catch (error) {
    console.error('Erro ao salvar mensagem:', error);
  }
}

async function enviarMensagemCheckout(hospedagemId) {
  const h = hospedagens.find(x => x.id === hospedagemId);
  if (!h) return;
  
  const pet = pets.find(p => p.id === h.petId);
  const cliente = pet ? clientes.find(c => c.id === pet.clienteId) : null;
  if (!cliente) return;
  
  const mensagem = configComunicacao.msgCheckout
    .replace('{cliente}', cliente.nome)
    .replace('{pet}', pet.nome);
  
  try {
    await salvarMensagemAPI({
      clienteId: cliente.id,
      petId: pet.id,
      tipo: 'Check-out',
      mensagem,
      status: 'Enviada'
    });
    
    // Enviar pesquisa de satisfação após 2 horas (simulado)
    setTimeout(() => enviarPesquisaSatisfacao(cliente, pet, 'Hospedagem', h.id), 2000);
    
    console.log(`📱 Check-out enviado para ${cliente.telefone}: ${mensagem}`);
  } catch (error) {
    console.error('Erro ao salvar mensagem de checkout:', error);
  }
}

async function enviarPesquisaSatisfacao(cliente, pet, servico, servicoId) {
  const mensagem = configComunicacao.msgSatisfacao
    .replace('{cliente}', cliente.nome)
    .replace('{pet}', pet.nome)
    .replace('{servico}', servico);
  
  try {
    await salvarMensagemAPI({
      clienteId: cliente.id,
      petId: pet.id,
      tipo: 'Satisfação',
      mensagem,
      status: 'Enviada'
    });
    
    console.log(`⭐ Pesquisa de satisfação enviada para ${cliente.telefone}: ${mensagem}`);
  } catch (error) {
    console.error('Erro ao salvar pesquisa de satisfação:', error);
  }
}

function registrarMensagem(clienteId, clienteNome, tipo, mensagem, status) {
  const msg = {
    id: nextMensagemId++,
    clienteId,
    clienteNome,
    tipo,
    mensagem,
    status,
    dataHora: new Date().toLocaleString('pt-BR')
  };
  
  mensagens.push(msg);
  saveState();
}

async function salvarConfiguracoesComunicacao() {
  try {
    const configData = {
      whatsappToken: document.getElementById('whatsappToken').value,
      whatsappNumero: document.getElementById('whatsappNumero').value,
      smsApiKey: document.getElementById('smsApiKey').value,
      msgCheckin: document.getElementById('msgCheckin').value,
      msgCheckout: document.getElementById('msgCheckout').value,
      msgLembrete: document.getElementById('msgLembrete').value,
      msgSatisfacao: document.getElementById('msgSatisfacao').value
    };

    const response = await fetch(`${API_BASE_URL}/configuracoes-comunicacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData)
    });

    if (response.ok) {
      configComunicacao = await response.json();
      alert('✅ Configurações de comunicação salvas!');
    } else {
      throw new Error('Erro ao salvar configurações');
    }
  } catch (error) {
    console.error('Erro ao salvar configurações de comunicação:', error);
    alert('Erro ao salvar configurações. Tente novamente.');
  }
}

function preencherConfigComunicacao() {
  document.getElementById('whatsappToken').value = configComunicacao.whatsappToken || '';
  document.getElementById('whatsappNumero').value = configComunicacao.whatsappNumero || '';
  document.getElementById('smsApiKey').value = configComunicacao.smsApiKey || '';
  document.getElementById('msgCheckin').value = configComunicacao.msgCheckin || '';
  document.getElementById('msgCheckout').value = configComunicacao.msgCheckout || '';
  document.getElementById('msgLembrete').value = configComunicacao.msgLembrete || '';
  document.getElementById('msgSatisfacao').value = configComunicacao.msgSatisfacao || '';
}


// ===== Sistema Financeiro Inteligente =====
function atualizarResumoFinanceiro() {
  const hoje = new Date();
  const inicioSemana = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  
  // Receita hoje
  const receitaHoje = [...hospedagens, ...creches]
    .filter(item => {
      const data = new Date(item.dataCriacao || item.data);
      return data >= inicioHoje;
    })
    .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  
  // Receita semana
  const receitaSemana = [...hospedagens, ...creches]
    .filter(item => {
      const data = new Date(item.dataCriacao || item.data);
      return data >= inicioSemana;
    })
    .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  
  // Receita mês
  const receitaMes = [...hospedagens, ...creches]
    .filter(item => {
      const data = new Date(item.dataCriacao || item.data);
      return data >= inicioMes;
    })
    .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  
  // Previsão próximo mês (baseada na média dos últimos 3 meses)
  const ultimosTresMeses = [...hospedagens, ...creches]
    .filter(item => {
      const data = new Date(item.dataCriacao || item.data);
      const tresMesesAtras = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
      return data >= tresMesesAtras;
    })
    .reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  
  const previsaoMes = ultimosTresMeses / 3;
  
  document.getElementById('receitaHoje').textContent = `R$ ${receitaHoje.toFixed(2).replace('.', ',')}`;
  document.getElementById('receitaSemana').textContent = `R$ ${receitaSemana.toFixed(2).replace('.', ',')}`;
  document.getElementById('receitaMes').textContent = `R$ ${receitaMes.toFixed(2).replace('.', ',')}`;
  document.getElementById('previsaoMes').textContent = `R$ ${previsaoMes.toFixed(2).replace('.', ',')}`;
}


// ===== Controle de Inadimplência =====
function atualizarSelectClientesInadimplencia() {
  const select = document.getElementById('inadimplenciaCliente');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione o cliente</option>';
  clientes.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.nome;
    select.appendChild(option);
  });
}

async function adicionarInadimplencia() {
  const clienteId = document.getElementById('inadimplenciaCliente').value;
  const valor = parseFloat(document.getElementById('valorAtraso').value);
  const vencimento = document.getElementById('dataVencimento').value;
  const descricao = document.getElementById('descricaoInadimplencia').value.trim();
  
  if (!clienteId || !valor || !vencimento || !descricao) {
    alert('Preencha todos os campos!');
    return;
  }
  
  const cliente = clientes.find(c => c.id == clienteId);
  if (!cliente) return;
  
  try {
    const inadimplenciaData = {
      clienteId: parseInt(clienteId),
      valor,
      vencimento,
      descricao
    };
    
    const novaInadimplencia = await salvarInadimplenciaAPI(inadimplenciaData);
    await carregarInadimplencias();
    limparFormularioInadimplencia();
    
    alert('📈 Inadimplência registrada!');
  } catch (error) {
    alert('Erro ao registrar inadimplência. Tente novamente.');
  }
}

function limparFormularioInadimplencia() {
  document.getElementById('inadimplenciaCliente').value = '';
  document.getElementById('valorAtraso').value = '';
  document.getElementById('dataVencimento').value = '';
  document.getElementById('descricaoInadimplencia').value = '';
}

function atualizarTabelaInadimplencia() {
  const tbody = document.getElementById('tabelaInadimplencia');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  inadimplencias.forEach(i => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td>${i.clienteNome}</td>
      <td>R$ ${i.valor.toFixed(2).replace('.', ',')}</td>
      <td>${new Date(i.vencimento).toLocaleDateString('pt-BR')}</td>
      <td>${i.diasAtraso} dias</td>
      <td>${i.descricao}</td>
      <td><span class="status-badge status-${i.status.toLowerCase()}">${i.status}</span></td>
      <td>
        <button class="btn btn-success" onclick="marcarComoPago(${i.id})">💰</button>
        <button class="btn btn-danger" onclick="excluirInadimplencia(${i.id})">🗑️</button>
      </td>
    `;
  });
}

async function marcarComoPago(id) {
  try {
    await atualizarInadimplenciaAPI(id, { 
      status: 'PAGO',
      dataPagamento: new Date().toISOString()
    });
    await carregarInadimplencias();
    alert('✅ Marcado como pago!');
  } catch (error) {
    alert('Erro ao atualizar inadimplência. Tente novamente.');
  }
}

async function excluirInadimplencia(id) {
  if (!confirm('Excluir este registro de inadimplência?')) return;
  
  try {
    await excluirInadimplenciaAPI(id);
    await carregarInadimplencias();
  } catch (error) {
    alert('Erro ao excluir inadimplência. Tente novamente.');
  }
}


// ===== Sistema de Avaliações =====
function atualizarTabelaAvaliacoes() {
  const tbody = document.getElementById('tabelaAvaliacoes');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  avaliacoes.slice(-20).reverse().forEach(a => {
    const row = tbody.insertRow();
    const estrelas = '⭐'.repeat(a.nota) + '☆'.repeat(5 - a.nota);
    row.innerHTML = `
      <td>${new Date(a.data).toLocaleDateString('pt-BR')}</td>
      <td>${a.clienteNome}</td>
      <td>${a.petNome}</td>
      <td>${a.servico}</td>
      <td>${estrelas} (${a.nota})</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${a.comentario || '-'}</td>
    `;
  });
}

function atualizarResumoSatisfacao() {
  const total = avaliacoes.length;
  const media = total > 0 ? avaliacoes.reduce((sum, a) => sum + a.nota, 0) / total : 0;
  
  const semanaPassada = new Date();
  semanaPassada.setDate(semanaPassada.getDate() - 7);
  const avaliacoesSemana = avaliacoes.filter(a => new Date(a.data) >= semanaPassada).length;
  
  document.getElementById('mediaSatisfacao').textContent = media.toFixed(1);
  document.getElementById('totalAvaliacoes').textContent = total;
  document.getElementById('avaliacoesSemana').textContent = avaliacoesSemana;
}

// ===== Ficha do Pet para Impressão =====
function imprimirFichaPet(petId) {
  const pet = pets.find(p => p.id === petId);
  if (!pet) {
    alert('Pet não encontrado!');
    return;
  }
  
  const cliente = clientes.find(c => c.id === pet.clienteId);
  const hoje = new Date().toLocaleDateString('pt-BR');
  
  const fichaHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #4a6baf; padding-bottom: 15px;">
        <h1 style="color: #4a6baf; margin: 0; font-size: 28px;">🐾 CLUBE PET</h1>
        <h2 style="color: #333; margin: 10px 0 0 0; font-size: 20px;">Ficha do Pet</h2>
        <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Gerado em ${hoje}</p>
      </div>
      
      ${pet.imagens && pet.imagens.length > 0 ? `
      <div style="background: #f0f8ff; border-left: 4px solid #4a6baf; padding: 15px; margin-bottom: 20px; text-align: center;">
        <img src="${pet.imagens[0].src}" alt="Foto do ${pet.nome}" style="max-width: 150px; height: auto; border: 1px solid #4a6baf; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      </div>
      ` : ''}
      
      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #4a6baf; margin: 0 0 15px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Dados do Pet</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Nome:</strong> ${pet.nome || '—'}</div>
          <div><strong>Espécie:</strong> ${pet.especie || '—'}</div>
          <div><strong>Raça:</strong> ${pet.raca || '—'}</div>
          <div><strong>Tamanho:</strong> ${pet.tamanho || '—'}</div>
          <div><strong>Idade:</strong> ${pet.idade || '—'}</div>
          <div><strong>Peso:</strong> ${pet.peso ? pet.peso + ' kg' : '—'}</div>
          <div><strong>Temperamento:</strong> ${pet.temperamento || '—'}</div>
          <div><strong>Castrado:</strong> ${pet.castrado || '—'}</div>
          <div><strong>Nº Cartão Vacina:</strong> ${pet.cartaoVacinaNumero || '—'}</div>
          <div><strong>Data Cadastro:</strong> ${pet.dataCadastro || '—'}</div>
        </div>
      </div>
      
      <div style="background: #f9f9f9; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <h3 style="color: #4a6baf; margin: 0 0 10px 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Tutor</h3>
        <div><strong>Nome:</strong> ${cliente?.nome || '—'}</div>
      </div>
      
      ${pet.medicamentos ? `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 25px; min-height: 120px;">
        <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">💊 Medicamentos</h3>
        <div style="color: #856404; font-size: 14px; line-height: 1.6;">${pet.medicamentos.replace(/\n/g, '<br>')}</div>
      </div>
      ` : `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 25px; min-height: 120px;">
        <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">💊 Medicamentos</h3>
        <div style="color: #856404; font-size: 14px; line-height: 1.6;">Nenhum medicamento informado</div>
      </div>
      `}
      
      ${pet.observacoes ? `
      <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; margin-bottom: 25px; min-height: 120px;">
        <h3 style="color: #0c5460; margin: 0 0 15px 0; font-size: 18px;">📝 Observações Especiais</h3>
        <div style="color: #0c5460; font-size: 14px; line-height: 1.6;">${pet.observacoes.replace(/\n/g, '<br>')}</div>
      </div>
      ` : `
      <div style="background: #d1ecf1; border-left: 4px solid #17a2b8; padding: 20px; margin-bottom: 25px; min-height: 120px;">
        <h3 style="color: #0c5460; margin: 0 0 15px 0; font-size: 18px;">📝 Observações Especiais</h3>
        <div style="color: #0c5460; font-size: 14px; line-height: 1.6;">Nenhuma observação especial</div>
      </div>
      `}
      
      ${pet.cartaoVacinaFoto ? `
      <div style="background: #e8f5e8; border-left: 4px solid #28a745; padding: 20px; margin-bottom: 25px;">
        <h3 style="color: #155724; margin: 0 0 15px 0; font-size: 18px;">💉 Cartão de Vacina</h3>
        <div style="text-align: center;">
          <img src="${pet.cartaoVacinaFoto.src}" alt="Cartão de Vacina" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p style="color: #155724; font-size: 12px; margin-top: 10px;">Nº: ${pet.cartaoVacinaNumero || '—'}</p>
        </div>
      </div>
      ` : ''}
      
      ${pet.imagens && pet.imagens.length > 1 ? `
      <div style="background: #fff9e6; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 25px;">
        <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">📷 Galeria do Pet</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
          ${pet.imagens.slice(1).map((img, index) => `
            <div>
              <img src="${img.src}" alt="Foto ${index + 2} do ${pet.nome}" style="width: 100%; max-width: 150px; height: 120px; object-fit: cover; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <p style="color: #856404; font-size: 10px; margin-top: 5px;">${img.nome || `Foto ${index + 2}`}</p>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <div style="margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p>Esta ficha pode ser usada como etiqueta para gaiolas/canis durante a hospedagem</p>
        <p><strong>Clube Pet</strong> - Sistema de Gestão</p>
      </div>
    </div>
  `;
  
  abrirPdfHtml(`Ficha do Pet - ${pet.nome}`, fichaHtml);
}

// Modificar função de checkout para enviar mensagem
function checkout(id) {
  const h = hospedagens.find(x => x.id === id);
  if (h) {
    h.status = 'Checkout';
    atualizarTabelaHospedagem();
    
    // Enviar mensagem de checkout
    enviarMensagemCheckout(id);
    
    alert('🏁 Check-out realizado! Mensagem enviada ao cliente.');
    saveState();
  }
}

// ===== Inicialização =====
document.addEventListener('DOMContentLoaded', ()=>{
  loadState();
  preencherConfiguracoes();
  atualizarTabelaClientes(); atualizarTabelaPets(); atualizarTabelaHospedagem(); atualizarTabelaCreche(); atualizarResumo();

  // Recalcular preços automaticamente
  ;['hospedagemPet','hospedagemCheckin','hospedagemCheckout','hospedagemPlano','servicoBanho','servicoConsultaVet','servicoTransporte']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('change', calcularPrecoHospedagem); });

  ;['crechePet','crecheData','crechePeriodo','crechePlano','atividadeAdaptacao','atividadeTreinamento']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('change', calcularPrecoCreche); });

  preencherPetsEmGaleria();
  renderGaleria();
  
  // Verificar lembretes diários
  verificarLembretes();
  
  // Carregar dados da API ao iniciar
  carregarClientes();
});

// ===== Sistema de Lembretes =====
function verificarLembretes() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const dataAmanha = amanha.toISOString().split('T')[0];
  
  // Verificar hospedagens para amanhã
  hospedagens.forEach(h => {
    if (h.checkin === dataAmanha && h.status === 'Ativo') {
      const pet = pets.find(p => p.id === h.petId);
      const cliente = pet ? clientes.find(c => c.id === pet.clienteId) : null;
      if (cliente && pet) {
        enviarLembrete(cliente, pet, 'Hospedagem', dataAmanha);
      }
    }
  });
  
  // Verificar creches para amanhã
  creches.forEach(c => {
    if (c.data === dataAmanha && c.status === 'Agendado') {
      const pet = pets.find(p => p.id === c.petId);
      const cliente = pet ? clientes.find(cl => cl.id === pet.clienteId) : null;
      if (cliente && pet) {
        enviarLembrete(cliente, pet, 'Creche', dataAmanha);
      }
    }
  });
}

function enviarLembrete(cliente, pet, servico, data) {
  const mensagem = configComunicacao.msgLembrete
    .replace('{cliente}', cliente.nome)
    .replace('{pet}', pet.nome)
    .replace('{servico}', servico)
    .replace('{data}', new Date(data).toLocaleDateString('pt-BR'));
  
  registrarMensagem(cliente.id, cliente.nome, 'Lembrete', mensagem, 'Enviada');
  console.log(`🔔 Lembrete enviado para ${cliente.telefone}: ${mensagem}`);
}

