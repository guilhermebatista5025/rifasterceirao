/*****************************************************************
 * GERENCIADOR DE RIFA PREMIUM - ORQUESTRADOR GLOBAL (js/index-app.js)
 *****************************************************************/

var TOTAL_NUMEROS = parseInt(localStorage.getItem("total_numeros"), 10) || 2000;
const VALOR_NUMERO = 2;

//=========================
// ESTADO GLOBAL (Compartilhado com os scripts das páginas)
//=========================
var supabaseClient = null;
var currentUser = null;
var userRole = 'user'; // 'user' ou 'admin'
var userDisplayName = '';
var initialAuthResolved = false;
window.initialAuthResolved = false;
var authEventsCount = 0;
window.authEventsCount = 0;
let numeroSelecionado = null;
let currentTab = 'tab-rifas';
let activeFiltro = 'todos';

// Cache compartilhado
const rifasData = {};
const elementosGrid = {};

//=========================
// ELEMENTOS DO DOM TIPO GLOBAL
//=========================
// Grid e Spinner
const grid = document.getElementById("grid");
const gridLoading = document.getElementById("grid-loading");

// Modais
const modalNumero = document.getElementById("modal");
const modalConfig = document.getElementById("modal-config");
const modalAuth = document.getElementById("modal-auth");

// Inputs Detalhes
const campoNome = document.getElementById("nome");
const campoObs = document.getElementById("obs");
const alertaNumero = document.getElementById("alerta");
const tituloNumero = document.getElementById("tituloNumero");

const configUrlInput = document.getElementById("config-url");
const configKeyInput = document.getElementById("config-key");

const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");

// Botões Rifa
const btnSalvar = document.getElementById("salvar");
const btnLiberar = document.getElementById("liberar");

// Painéis e Badges (existem apenas em index.html)
const txtVendidos = document.getElementById("vendidos");
const txtDisponiveis = document.getElementById("disponiveis");
const txtPercentual = document.getElementById("percentual");
const txtArrecadado = document.getElementById("arrecadado");

// Navegação e Banners
const statusBanner = document.getElementById("status-banner");
const authStatusContainer = document.getElementById("auth-status-container");
const navMeusNumeros = document.getElementById("nav-meus-numeros");
const navAdmin = document.getElementById("nav-admin");

// Busca e Filtros (apenas index.html)
const pesquisaInput = document.getElementById("pesquisa");
const filtrosBotoes = document.querySelectorAll(".btn-filtro");

//=========================
// FUNÇÕES AUXILIARES GLOBAIS
//=========================
function formatarNumero(numero) {
    return numero.toString().padStart(4, "0");
}

function formatarData(dataString) {
    if (!dataString) return "-";
    const data = new Date(dataString);
    return data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function exibirNotificacao(mensagem, tipo = 'info') {
    alert(mensagem);
}

//=========================
// ROTEAMENTO DE ABAS (Para index.html)
//=========================
function setupNavigation() {
    const logoBrand = document.querySelector(".nav-brand");
    if (logoBrand) {
        logoBrand.addEventListener("click", () => {
            const isInPagesFolder = window.location.pathname.includes('/pages/');
            window.location.href = isInPagesFolder ? "../index.html" : "index.html";
        });
    }
}

//=========================
// INICIALIZAÇÃO SUPABASE
//=========================
async function carregarTotalRifasBanco() {
    if (!supabaseClient) return;

    try {
        // Tenta buscar da tabela 'config'
        const { data, error } = await supabaseClient
            .from("config")
            .select("value")
            .eq("key", "total_rifas")
            .single();

        if (!error && data) {
            const val = parseInt(data.value, 10);
            if (!isNaN(val) && val > 0) {
                TOTAL_NUMEROS = val;
                localStorage.setItem("total_numeros", val.toString());
                if (window.gerarGridNumeros) window.gerarGridNumeros();
                if (window.carregarDadosBanco) window.carregarDadosBanco();
                if (window.carregarDadosAdmin) window.carregarDadosAdmin();
                return;
            }
        }
    } catch (e) {}

    // Fallback: busca da tabela 'rifas' com numero = 0
    try {
        const { data, error } = await supabaseClient
            .from("rifas")
            .select("observacao")
            .eq("numero", 0)
            .single();

        if (!error && data) {
            const val = parseInt(data.observacao, 10);
            if (!isNaN(val) && val > 0) {
                TOTAL_NUMEROS = val;
                localStorage.setItem("total_numeros", val.toString());
                if (window.gerarGridNumeros) window.gerarGridNumeros();
                if (window.carregarDadosBanco) window.carregarDadosBanco();
                if (window.carregarDadosAdmin) window.carregarDadosAdmin();
                return;
            }
        }
    } catch (e) {}
}

function initSupabase() {
    let url = localStorage.getItem("supabase_url");
    let key = localStorage.getItem("supabase_key");

    // Fallback seguro extraído do .env (previne strings "null", vazias ou inválidas como "mock")
    if (!url || url === "null" || url.trim() === "" || url.includes("invalid-url") || !url.trim().startsWith("http")) {
        url = "https://elhfxctqmubpufqrzbdi.supabase.co";
    }
    if (!key || key === "null" || key.trim() === "" || key.includes("invalid-key") || key.length < 20) {
        key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsaGZ4Y3RxbXVicHVmcXJ6YmRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDk2MTksImV4cCI6MjA5MzEyNTYxOX0.3E9yBlWxJm0QkBOh4cj06XhR_cWsBbo3Rj9NCCoeRsg";
    }

    if (url && key) {
        try {
            supabaseClient = window.supabase.createClient(url.trim(), key.trim());
            if (statusBanner) statusBanner.style.display = "none";
            
            // Ouvinte de Autenticação
            supabaseClient.auth.onAuthStateChange((event, session) => {
                handleAuthStateChange(session);
            });
            
            // Carregar configurações de total de rifas
            carregarTotalRifasBanco();

        } catch (error) {
            console.error("Erro ao inicializar SupabaseClient:", error);
            if (statusBanner) statusBanner.style.display = "block";
        }
    } else {
        supabaseClient = null;
        if (statusBanner) statusBanner.style.display = "block";
        exibirGridLoading(false);
        if (window.renderizarGridMock) window.renderizarGridMock();
    }
}

function exibirGridLoading(carregando) {
    if (gridLoading) {
        gridLoading.style.display = carregando ? "flex" : "none";
    }
}

//=========================
// CONFIGURAÇÃO DO BANCO
//=========================
function setupConfigModal() {
    const btnAbrir = document.getElementById("btn-abrir-config");
    const btnFechar = document.getElementById("btn-fechar-config");
    const btnCancelar = document.getElementById("btn-cancelar-config");
    const btnSalvarConfig = document.getElementById("btn-salvar-config");
    const btnBanner = document.getElementById("btn-configurar-banner");

    function abrir() {
        configUrlInput.value = localStorage.getItem("supabase_url") || "";
        configKeyInput.value = localStorage.getItem("supabase_key") || "";
        modalConfig.style.display = "flex";
    }

    function fechar() {
        modalConfig.style.display = "none";
    }

    if (btnAbrir) btnAbrir.onclick = abrir;
    if (btnFechar) btnFechar.onclick = fechar;
    if (btnCancelar) btnCancelar.onclick = fechar;
    if (btnBanner) btnBanner.onclick = abrir;

    if (btnSalvarConfig) {
        btnSalvarConfig.onclick = () => {
            const url = configUrlInput.value.trim();
            const key = configKeyInput.value.trim();

            if (!url || !key) {
                exibirNotificacao("Preencha os campos da conexão.", "error");
                return;
            }

            localStorage.setItem("supabase_url", url);
            localStorage.setItem("supabase_key", key);
            
            fechar();

            // Re-renderizar o grid e os dados imediatamente
            if (window.gerarGridNumeros) window.gerarGridNumeros();
            if (window.carregarDadosBanco) window.carregarDadosBanco();
            if (window.carregarDadosAdmin) window.carregarDadosAdmin();

            initSupabase();
            exibirNotificacao("Conexão salva com sucesso!", "success");
        };
    }

    window.addEventListener("click", (e) => {
        if (e.target === modalConfig) fechar();
    });
}

//=========================
// CONTROLES DE AUTENTICAÇÃO
//=========================
function setupAuthModal() {
    const btnLoginTrigger = document.getElementById("btn-login-trigger");
    const btnFecharAuth = document.getElementById("btn-fechar-auth");
    const tabBtnLogin = document.getElementById("tab-btn-login");
    const tabBtnRegister = document.getElementById("tab-btn-register");

    function abrir() {
        modalAuth.style.display = "flex";
        
        let alertaAuth = document.getElementById("alerta-auth");
        if (!alertaAuth) {
            alertaAuth = document.createElement("div");
            alertaAuth.id = "alerta-auth";
            alertaAuth.className = "alerta";
            alertaAuth.style.margin = "20px 28px 0 28px";
            modalAuth.querySelector(".modal-content").prepend(alertaAuth);
        }

        if (!supabaseClient) {
            alertaAuth.style.display = "block";
            alertaAuth.textContent = "⚠️ Banco de dados não conectado. Vá em Configurações (⚙️) para ativar o login.";
            formLogin.style.opacity = "0.6";
            formRegister.style.opacity = "0.6";
            formLogin.querySelector("button").disabled = true;
            formRegister.querySelector("button").disabled = true;
        } else {
            alertaAuth.style.display = "none";
            formLogin.style.opacity = "1";
            formRegister.style.opacity = "1";
            formLogin.querySelector("button").disabled = false;
            formRegister.querySelector("button").disabled = false;
        }
    }

    function fechar() {
        modalAuth.style.display = "none";
    }

    if (btnLoginTrigger) {
        btnLoginTrigger.onclick = () => {
            if (currentUser) {
                realizarLogout();
            } else {
                abrir();
            }
        };
    }

    if (btnFecharAuth) btnFecharAuth.onclick = fechar;

    if (tabBtnLogin && tabBtnRegister) {
        tabBtnLogin.onclick = () => {
            tabBtnLogin.classList.add("active");
            tabBtnRegister.classList.remove("active");
            formLogin.classList.add("active");
            formRegister.classList.remove("active");
        };

        tabBtnRegister.onclick = () => {
            tabBtnRegister.classList.add("active");
            tabBtnLogin.classList.remove("active");
            formRegister.classList.add("active");
            formLogin.classList.remove("active");
        };
    }

    // Formulário Login
    if (formLogin) {
        formLogin.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const senha = document.getElementById("login-senha").value.trim();

            const { error } = await supabaseClient.auth.signInWithPassword({
                email,
                password: senha
            });

            if (error) {
                exibirNotificacao("Erro no login: " + error.message, "error");
            } else {
                fechar();
                exibirNotificacao("Logado com sucesso!", "success");
            }
        };
    }

    // Formulário Registro
    if (formRegister) {
        formRegister.onsubmit = async (e) => {
            e.preventDefault();
            const nome = document.getElementById("register-nome").value.trim();
            const email = document.getElementById("register-email").value.trim();
            const senha = document.getElementById("register-senha").value.trim();
            const role = 'user';

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password: senha,
                options: {
                    data: {
                        full_name: nome,
                        role: role
                    }
                }
            });

            if (error) {
                exibirNotificacao("Erro: " + error.message, "error");
            } else {
                fechar();
                if (data && data.session) {
                    exibirNotificacao("Conta criada e conectada com sucesso!", "success");
                } else {
                    exibirNotificacao("Cadastro realizado! Por favor, verifique seu e-mail para confirmar a conta antes de fazer o login.", "info");
                }
            }
        };
    }

    window.addEventListener("click", (e) => {
        if (e.target === modalAuth) fechar();
    });
}

async function handleAuthStateChange(session) {
    currentUser = session?.user || null;

    // Prevenir condição de corrida na restauração da sessão do Supabase
    if (!currentUser && !window.initialAuthResolved) {
        const temToken = () => {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.includes("auth-token") || k.startsWith("sb-"))) {
                    const val = localStorage.getItem(k);
                    if (val && val !== "null" && val.trim() !== "") return true;
                }
            }
            return false;
        };
        
        if (temToken() && window.authEventsCount === 0) {
            window.authEventsCount++;
            console.log("⏳ Aguardando restauração da sessão do Supabase...");
            return;
        }
    }
    
    window.authEventsCount++;
    const triggerBtn = document.getElementById("btn-login-trigger");
    const isInPagesFolder = window.location.pathname.includes('/pages/');

    if (currentUser) {
        // Obter Perfil
        const { data: profile } = await supabaseClient
            .from("profiles")
            .select("role, full_name")
            .eq("id", currentUser.id)
            .single();

        if (profile) {
            userRole = profile.role;
            userDisplayName = profile.full_name;
        } else {
            userRole = currentUser.user_metadata?.role || "user";
            userDisplayName = currentUser.user_metadata?.full_name || currentUser.email;
        }

        if (triggerBtn) {
            triggerBtn.className = "btn-secondary";
            triggerBtn.innerHTML = `Sair (${userDisplayName.split(" ")[0]})`;
        }
        
        // Ativar Links do Papel correspondente
        if (userRole === 'admin') {
            if (navMeusNumeros) navMeusNumeros.style.display = "none";
            if (navAdmin) navAdmin.style.display = "block";
            
            // Se estiver na Home e logar como admin, redireciona para painel admin automaticamente
            if (!isInPagesFolder && modalAuth && modalAuth.style.display === "flex") {
                window.location.href = "pages/admin.html";
            }
        } else {
            if (navMeusNumeros) navMeusNumeros.style.display = "block";
            if (navAdmin) navAdmin.style.display = "none";
            
            // Se for usuário comum na página de admin, manda de volta pra home
            if (isInPagesFolder && window.location.pathname.includes("admin.html")) {
                window.location.href = "../index.html";
            }
        }

        // Atualizar links flutuantes mobile
        const floatUser = document.getElementById("float-link-user");
        const floatAdmin = document.getElementById("float-link-admin");
        if (floatUser) floatUser.style.display = (userRole !== 'admin') ? "flex" : "none";
        if (floatAdmin) floatAdmin.style.display = (userRole === 'admin') ? "flex" : "none";
    } else {
        userRole = 'user';
        userDisplayName = '';
        
        if (triggerBtn) {
            triggerBtn.className = "btn-primary";
            triggerBtn.innerHTML = "Entrar";
        }
        
        if (navMeusNumeros) navMeusNumeros.style.display = "none";
        if (navAdmin) navAdmin.style.display = "none";

        // Ocultar links flutuantes mobile
        const floatUser = document.getElementById("float-link-user");
        const floatAdmin = document.getElementById("float-link-admin");
        if (floatUser) floatUser.style.display = "none";
        if (floatAdmin) floatAdmin.style.display = "none";
        
        // Se deslogar e estiver na pasta pages, redireciona para a home
        if (isInPagesFolder) {
            window.location.href = "../index.html";
        }
    }

    window.initialAuthResolved = true;

    if (window.carregarDadosBanco) window.carregarDadosBanco();
    if (window.carregarMeusNumeros) window.carregarMeusNumeros();
    if (window.carregarDadosAdmin) window.carregarDadosAdmin();

    console.log("🔐 Sessão Auth:", currentUser ? `Logado como ${currentUser.email}` : "Deslogado", "| Cargo Resolvido:", userRole);
}

//=========================
// MENU FLUTUANTE MOBILE
//=========================
function setupMobileFloatingMenu() {
    if (document.getElementById("mobile-floating-menu")) return;

    const menuContainer = document.createElement("div");
    menuContainer.id = "mobile-floating-menu";
    menuContainer.className = "mobile-floating-menu";

    const isInPagesFolder = window.location.pathname.includes("/pages/");
    const prefix = isInPagesFolder ? "" : "pages/";
    const rootPrefix = isInPagesFolder ? "../" : "";

    const linkRifas = `${rootPrefix}index.html`;
    const linkUser = `${prefix}user.html`;
    const linkAdmin = `${prefix}admin.html`;

    menuContainer.innerHTML = `
        <button id="btn-floating-toggle" class="btn-floating-main" aria-label="Menu de Navegação">
            <i class="fa-solid fa-compass"></i>
        </button>
        <div id="floating-menu-items" class="floating-menu-items">
            <a href="${linkRifas}" class="floating-item" id="float-link-rifas">
                <i class="fa-solid fa-ticket"></i> <span>Rifas</span>
            </a>
            <a href="${linkUser}" class="floating-item" id="float-link-user" style="display: none;">
                <i class="fa-solid fa-user"></i> <span>Meus Números</span>
            </a>
            <a href="${linkAdmin}" class="floating-item" id="float-link-admin" style="display: none;">
                <i class="fa-solid fa-user-shield"></i> <span>Painel Admin</span>
            </a>
        </div>
    `;

    document.body.appendChild(menuContainer);

    const btnToggle = document.getElementById("btn-floating-toggle");

    if (btnToggle) {
        btnToggle.onclick = (e) => {
            e.stopPropagation();
            menuContainer.classList.toggle("open");
        };

        document.addEventListener("click", () => {
            menuContainer.classList.remove("open");
        });
    }

    // Se já estiver inicializado com sessão antes de carregar o DOM,
    // atualizamos os estados das abas imediatamente
    if (currentUser) {
        const floatUser = document.getElementById("float-link-user");
        const floatAdmin = document.getElementById("float-link-admin");
        if (floatUser) floatUser.style.display = (userRole !== 'admin') ? "flex" : "none";
        if (floatAdmin) floatAdmin.style.display = (userRole === 'admin') ? "flex" : "none";
    }
}

async function realizarLogout() {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        exibirNotificacao("Erro ao deslogar: " + error.message, "error");
    } else {
        exibirNotificacao("Deslogado com sucesso.", "success");
    }
}

//=========================
// INICIALIZAÇÃO DOM
//=========================
document.addEventListener("DOMContentLoaded", () => {
    if (window.gerarGridNumeros) window.gerarGridNumeros();
    
    setupNavigation();
    setupConfigModal();
    setupAuthModal();
    setupMobileFloatingMenu(); // Inicializa o menu flutuante mobile
    
    if (window.setupFiltrosEPesquisa) window.setupFiltrosEPesquisa();
    
    initSupabase();
});

window.carregarTotalRifasBanco = carregarTotalRifasBanco;
