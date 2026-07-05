/*****************************************************************
 * RIFA PAGE LOGIC - js/rifas.js
 *****************************************************************/

let modoSelecaoAtivo = false;
let numerosSelecionadosList = [];

// Lista de promotores
const VENDEDORES = [
    { nome: "Guilherme", whatsapp: "5527998803770" },
    { nome: "Estevão", whatsapp: "5527999829385" },
    { nome: "Talyta", whatsapp: "5527998010374" },
    { nome: "Giuliano", whatsapp: "5527997416562" }
];

function extrairTagsObservacao(obsText) {
    if (!obsText) return { pagamento: "", vendedor: "", textoLimpo: "" };
    
    let pagamento = "";
    let vendedor = "";
    let textoLimpo = obsText;
    
    const pgmtoMatch = textoLimpo.match(/\[Pgmto:\s*([^\]]+)\]/i);
    if (pgmtoMatch) {
        pagamento = pgmtoMatch[1].toLowerCase().trim();
        textoLimpo = textoLimpo.replace(pgmtoMatch[0], "");
    }
    
    const vendMatch = textoLimpo.match(/\[Vendedor:\s*([^\]]+)\]/i);
    if (vendMatch) {
        vendedor = vendMatch[1].trim();
        textoLimpo = textoLimpo.replace(vendMatch[0], "");
    }
    
    // Remover tag [Lote] caso exista
    textoLimpo = textoLimpo.replace(/\[Lote\]/gi, "");
    
    return {
        pagamento: pagamento,
        vendedor: vendedor,
        textoLimpo: textoLimpo.trim()
    };
}

function popularSelectVendedores(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="" disabled selected>Selecione um vendedor</option>';
    VENDEDORES.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.nome;
        opt.textContent = v.nome;
        selectElement.appendChild(opt);
    });
}

//=========================
// RENDERIZAR GRID & CARREGAR DADOS
//=========================
function gerarGridNumeros() {
    if (!grid) return; // Segurança para páginas sem o grid
    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= TOTAL_NUMEROS; i++) {
        const div = document.createElement("div");
        div.className = "numero disponivel";
        div.dataset.numero = i;
        div.textContent = formatarNumero(i);
        div.title = "Disponível";
        
        div.addEventListener("click", () => {
            if (modoSelecaoAtivo) {
                if (div.classList.contains("vendido")) return;
                
                const numVal = i;
                const index = numerosSelecionadosList.indexOf(numVal);
                if (index > -1) {
                    numerosSelecionadosList.splice(index, 1);
                    div.classList.remove("selected-temp");
                } else {
                    numerosSelecionadosList.push(numVal);
                    div.classList.add("selected-temp");
                }
                atualizarFooterSelecao();
            } else {
                numerosSelecionadosList = [i];
                abrirDetalhesNumero(i);
            }
        });

        elementosGrid[i] = div;
        fragment.appendChild(div);
    }

    grid.appendChild(fragment);
}

function renderizarGridMock() {
    gerarGridNumeros();
    atualizarPainelEstatisticas();
}

async function carregarDadosBanco() {
    if (!supabaseClient) return;
    
    exibirGridLoading(true);

    try {
        // Buscar todas as reservas da tabela 'rifas' (Excluindo a linha de config com numero=0)
        let resultadoQuery = await supabaseClient
            .from("rifas")
            .select("*, profiles(full_name)")
            .gt("numero", 0)
            .order("numero");

        // Se falhar devido à relação de tabela (ex: perfis/profiles não mapeados), tenta ler apenas rifas
        if (resultadoQuery.error && (resultadoQuery.error.code === 'PGRST200' || resultadoQuery.error.code === 'PGRST205' || resultadoQuery.error.message.includes('relationship'))) {
            console.warn("Relação com 'profiles' inexistente no banco. Buscando dados simples da tabela 'rifas'...");
            resultadoQuery = await supabaseClient
                .from("rifas")
                .select("*")
                .gt("numero", 0)
                .order("numero");
        }

        if (resultadoQuery.error) throw resultadoQuery.error;
        const reservas = resultadoQuery.data;

        // Limpar dados anteriores
        for (let i = 1; i <= TOTAL_NUMEROS; i++) {
            delete rifasData[i];
            
            const div = elementosGrid[i];
            if (div) {
                div.className = "numero disponivel";
                div.title = "Disponível";
            }
        }

        // Adicionar novos dados
        if (reservas) {
            reservas.forEach(res => {
                rifasData[res.numero] = {
                    nome: res.nome,
                    observacao: res.observacao || "",
                    user_id: res.user_id,
                    data_compra: res.created_at,
                    full_name: res.profiles?.full_name || res.nome
                };

                const div = elementosGrid[res.numero];
                if (div) {
                    div.className = "numero vendido";
                    div.title = `Reservado para: ${res.profiles?.full_name || res.nome}`;
                }
            });
        }

        atualizarPainelEstatisticas();
        aplicarFiltrosEPesquisa();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
        const msg = error.message || error.details || JSON.stringify(error);
        exibirNotificacao("Erro ao conectar com o banco de dados: " + msg, "error");
        const statusBanner = document.getElementById("status-banner");
        if (statusBanner) statusBanner.style.display = "block";
    } finally {
        exibirGridLoading(false);
    }
}

function atualizarPainelEstatisticas() {
    const vendidos = Object.keys(rifasData).length;
    const disponiveis = TOTAL_NUMEROS - vendidos;
    const percentual = ((vendidos / TOTAL_NUMEROS) * 100).toFixed(1);
    const arrecadado = vendidos * VALOR_NUMERO;

    if (txtVendidos) txtVendidos.textContent = vendidos;
    if (txtDisponiveis) txtDisponiveis.textContent = disponiveis;
    if (txtPercentual) txtPercentual.textContent = `${percentual}%`;
    if (txtArrecadado) {
        txtArrecadado.textContent = arrecadado.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }
}

//=========================
// FILTROS E PESQUISA
//=========================
function setupFiltrosEPesquisa() {
    if (!pesquisaInput) return; // Segurança para páginas sem busca

    // Input Pesquisa
    pesquisaInput.addEventListener("input", aplicarFiltrosEPesquisa);

    // Botões Filtros
    filtrosBotoes.forEach(btn => {
        btn.addEventListener("click", () => {
            filtrosBotoes.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            activeFiltro = btn.getAttribute("data-filtro");
            aplicarFiltrosEPesquisa();
        });
    });
}

function aplicarFiltrosEPesquisa() {
    if (!pesquisaInput) return;
    const texto = pesquisaInput.value.toLowerCase().trim();

    for (let i = 1; i <= TOTAL_NUMEROS; i++) {
        const div = elementosGrid[i];
        if (!div) continue;

        const reserva = rifasData[i];
        let statusMatch = true;
        let buscaMatch = true;

        // Filtragem Status
        if (activeFiltro === "disponiveis" && reserva) {
            statusMatch = false;
        } else if (activeFiltro === "vendidos" && !reserva) {
            statusMatch = false;
        }

        // Filtragem Busca
        if (texto !== "") {
            const numStr = formatarNumero(i);
            const nomeComprador = reserva ? (reserva.full_name || "").toLowerCase() : "";
            
            if (!numStr.includes(texto) && !nomeComprador.includes(texto)) {
                buscaMatch = false;
            }
        }

        if (statusMatch && buscaMatch) {
            div.style.display = "flex";
        } else {
            div.style.display = "none";
        }
    }
}

//=========================
// MODAL DE RESERVA DE NÚMERO
//=========================
function abrirDetalhesNumero(numero) {
    if (!modalNumero) return;

    numeroSelecionado = numero;
    tituloNumero.textContent = `Número ${formatarNumero(numero)}`;

    const registro = rifasData[numero];
    const infoProprietario = document.getElementById("info-proprietario");

    // Reset de Elementos
    alertaNumero.style.display = "none";
    if (infoProprietario) infoProprietario.style.display = "none";
    campoNome.disabled = false;
    campoObs.disabled = false;
    btnSalvar.style.display = "inline-flex";
    btnLiberar.style.display = "none";

    // Reset do campo de pagamento e vendedor
    const gpPagamento = document.getElementById("grupo-pagamento");
    const gpChavePix = document.getElementById("grupo-chave-pix");
    const selectPagamento = document.getElementById("tipo-pagamento");
    const gpVendedor = document.getElementById("grupo-vendedor");
    const selectVendedor = document.getElementById("vendedor");

    if (gpPagamento) gpPagamento.style.display = "none";
    if (gpChavePix) gpChavePix.style.display = "none";
    if (selectPagamento) {
        selectPagamento.value = "dinheiro";
        selectPagamento.disabled = false;
    }
    if (gpVendedor) gpVendedor.style.display = "none";
    if (selectVendedor) {
        selectVendedor.value = "";
        selectVendedor.disabled = false;
    }

    // Atualizar resumo de totais no modal
    const textQtdModal = document.getElementById("qtd-selecionada-modal");
    const textValorModal = document.getElementById("valor-total-modal");
    if (textQtdModal) textQtdModal.textContent = "1 número";
    if (textValorModal) textValorModal.textContent = `R$ ${VALOR_NUMERO.toFixed(2).replace(".", ",")}`;

    if (!supabaseClient) {
        alertaNumero.style.display = "block";
        alertaNumero.textContent = "⚠️ Banco de dados não conectado. Configure o Supabase para gerenciar números.";
        campoNome.disabled = true;
        campoObs.disabled = true;
        btnSalvar.style.display = "none";
        btnLiberar.style.display = "none";
        modalNumero.style.display = "flex";
        return;
    }

    if (registro) {
        // Reservado
        alertaNumero.style.display = "block";
        if (infoProprietario) {
            infoProprietario.style.display = "block";
            document.getElementById("info-nome-proprietario").textContent = registro.full_name;
            document.getElementById("info-data-proprietario").textContent = formatarData(registro.data_compra);
        }

        const tags = extrairTagsObservacao(registro.observacao);
        campoNome.value = registro.nome;
        campoObs.value = tags.textoLimpo;

        // Exibe os selects preenchidos para consulta/edição se tags estiverem presentes
        if (gpPagamento && tags.pagamento) {
            gpPagamento.style.display = "block";
            selectPagamento.value = tags.pagamento;
        }
        if (gpVendedor && tags.vendedor) {
            gpVendedor.style.display = "block";
            popularSelectVendedores(selectVendedor);
            selectVendedor.value = tags.vendedor;
        }

        // Controle de Acesso
        if (userRole === "admin") {
            campoNome.disabled = false;
            campoObs.disabled = false;
            if (selectPagamento) selectPagamento.disabled = false;
            if (selectVendedor) selectVendedor.disabled = false;
            btnSalvar.textContent = "Atualizar Cadastro";
            btnSalvar.style.display = "inline-flex";
            btnLiberar.style.display = "inline-flex";
        } else if (currentUser && registro.user_id === currentUser.id) {
            campoNome.disabled = true;
            campoObs.disabled = false;
            if (selectPagamento) selectPagamento.disabled = true;
            if (selectVendedor) selectVendedor.disabled = true;
            btnSalvar.textContent = "Salvar Alterações";
            btnSalvar.style.display = "inline-flex";
            btnLiberar.style.display = "inline-flex";
            btnLiberar.textContent = "Cancelar Minha Reserva";
        } else {
            campoNome.disabled = true;
            campoObs.disabled = true;
            if (selectPagamento) selectPagamento.disabled = true;
            if (selectVendedor) selectVendedor.disabled = true;
            btnSalvar.style.display = "none";
            btnLiberar.style.display = "none";
            alertaNumero.textContent = "⚠ ESTE NÚMERO JÁ FOI ADQUIRIDO POR OUTRO COMPRADOR";
        }
    } else {
        // Livre
        campoNome.value = "";
        campoObs.value = "";
        btnSalvar.textContent = "Reservar Número";

        if (!currentUser) {
            campoNome.disabled = true;
            campoObs.disabled = true;
            btnSalvar.style.display = "none";
            alertaNumero.style.display = "block";
            alertaNumero.textContent = "⚠️ Faça login para reservar esta rifa.";
        } else {
            if (userRole !== "admin") {
                campoNome.value = userDisplayName;
                campoNome.disabled = true;
            }
            // Mostrar escolha de pagamento e vendedor para nova reserva
            if (gpPagamento) gpPagamento.style.display = "block";
            if (gpVendedor) {
                gpVendedor.style.display = "block";
                popularSelectVendedores(selectVendedor);
            }
        }
    }

    modalNumero.style.display = "flex";
}

function fecharModal() {
    if (modalNumero) modalNumero.style.display = "none";
}

// ─── Helpers de UI do botão Reservar ───────────────────────────────────────
function setSpinnerSalvar(ativo, texto = "Reservar Número") {
    const spinner = document.getElementById("salvar-spinner");
    const textoEl = document.getElementById("salvar-texto");
    if (spinner) spinner.style.display = ativo ? "inline-block" : "none";
    if (textoEl) textoEl.textContent = ativo ? "Salvando..." : texto;
    if (btnSalvar) btnSalvar.disabled = ativo;
}

function abrirWhatsApp(nome, numero, obs, pagamento, vendedorNome) {
    const numFormatado = formatarNumero(numero);
    const pgmto = pagamento ? pagamento.toUpperCase() : "NÃO INFORMADO";
    const valorTotal = `R$ ${VALOR_NUMERO.toFixed(2).replace(".", ",")}`;
    const obsTexto = obs ? `\nObs: ${obs}` : "";
    
    // Encontra o contato do vendedor correto
    const vendedorObj = VENDEDORES.find(v => v.nome === vendedorNome) || VENDEDORES[0];
    const waNumber = vendedorObj.whatsapp;
    
    const msg = `Olá ${vendedorObj.nome}! Quero confirmar a minha reserva na Rifa Terceirão 🎟️\n\n*Nome:* ${nome}\n*Número:* ${numFormatado}\n*Pagamento:* ${pgmto}\n*Valor:* ${valorTotal}${obsTexto}\n\n👉 *Estou enviando o comprovante do PIX em anexo!* 📎`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
}

// Ouvintes do Modal de Reserva
if (btnSalvar) {
    btnSalvar.onclick = async () => {
        const nome = campoNome.value.trim();
        let obs = campoObs.value.trim();

        if (!nome) {
            exibirNotificacao("Preencha o nome do comprador.", "warning");
            return;
        }

        const selectPagamento = document.getElementById("tipo-pagamento");
        const formaPagamento = selectPagamento ? selectPagamento.value : "dinheiro";
        const selectVendedor = document.getElementById("vendedor");
        const nomeVendedor = selectVendedor ? selectVendedor.value : "";
        const registroExistente = rifasData[numeroSelecionado];

        // 1) Iniciar spinner
        setSpinnerSalvar(true);

        // Anexar forma de pagamento e vendedor na observação para novos registros ou atualização de admin
        if (!registroExistente) {
            if (!nomeVendedor) {
                exibirNotificacao("Selecione com quem você comprou a rifa.", "warning");
                setSpinnerSalvar(false);
                return;
            }
            const tags = `[Pgmto: ${formaPagamento.toUpperCase()}] [Vendedor: ${nomeVendedor}]`;
            obs = obs ? `${tags} ${obs}` : tags;
        } else if (userRole === "admin") {
            const tags = `[Pgmto: ${formaPagamento.toUpperCase()}] [Vendedor: ${nomeVendedor}]`;
            obs = obs ? `${tags} ${obs}` : tags;
        }

        try {
            if (registroExistente) {
                const { error } = await supabaseClient
                    .from("rifas")
                    .update({ nome: nome, observacao: obs })
                    .eq("numero", numeroSelecionado);

                if (error) throw error;
                exibirNotificacao("Rifa atualizada com sucesso!", "success");
            } else {
                // 2) Salvar no banco
                const { error } = await supabaseClient
                    .from("rifas")
                    .insert({
                        numero: numeroSelecionado,
                        nome: nome,
                        observacao: obs,
                        user_id: currentUser ? currentUser.id : null
                    });

                if (error) throw error;
                exibirNotificacao("Reserva realizada! Abrindo WhatsApp...", "success");

                // 3) Após salvar, redirecionar para WhatsApp
                setTimeout(() => abrirWhatsApp(nome, numeroSelecionado, campoObs.value.trim(), formaPagamento, nomeVendedor), 600);
            }

            fecharModal();
            carregarDadosBanco();
            if (window.carregarMeusNumeros) window.carregarMeusNumeros();
            if (window.carregarDadosAdmin) window.carregarDadosAdmin();

        } catch (error) {
            exibirNotificacao("Erro ao salvar: " + error.message, "error");
        } finally {
            setSpinnerSalvar(false, btnSalvar.querySelector && document.getElementById("salvar-texto")?.textContent || "Reservar Número");
        }
    };
}

if (btnLiberar) {
    btnLiberar.onclick = async () => {
        if (!confirm(`Deseja liberar o número ${formatarNumero(numeroSelecionado)} e torná-lo disponível para venda?`)) return;

        try {
            const { error } = await supabaseClient
                .from("rifas")
                .delete()
                .eq("numero", numeroSelecionado);

            if (error) throw error;

            exibirNotificacao("Rifa liberada com sucesso!", "success");
            fecharModal();
            carregarDadosBanco();

            if (window.carregarMeusNumeros) window.carregarMeusNumeros();
            if (window.carregarDadosAdmin) window.carregarDadosAdmin();

        } catch (error) {
            exibirNotificacao("Erro ao liberar: " + error.message, "error");
        }
    };
}

window.onclick = (e) => {
    if (e.target === modalNumero) fecharModal();
};

window.abrirDetalhesNumero = abrirDetalhesNumero;
window.fecharModal = fecharModal;
window.gerarGridNumeros = gerarGridNumeros;
window.renderizarGridMock = renderizarGridMock;
window.carregarDadosBanco = carregarDadosBanco;
window.setupFiltrosEPesquisa = setupFiltrosEPesquisa;

// ─── Atualizar texto e visibilidade do rodapé flutuante ────────────────────
function atualizarFooterSelecao() {
    const footer = document.getElementById("footer-selecao-flutuante");
    const texto = document.getElementById("texto-numeros-selecionados");
    if (!footer) return;

    const qtd = numerosSelecionadosList.length;
    if (qtd === 0) {
        footer.classList.remove("show");
    } else {
        footer.classList.add("show");
        const nums = numerosSelecionadosList.map(n => formatarNumero(n)).join(", ");
        const total = qtd * VALOR_NUMERO;
        const totalFormatado = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        if (texto) {
            texto.innerHTML = `<span style="font-weight: 700; color: var(--text-main); font-size: 15px;">
                ${qtd} número${qtd > 1 ? "s" : ""} selecionado${qtd > 1 ? "s" : ""} | Total: 
                <strong style="color: var(--color-success);">${totalFormatado}</strong>
            </span>
            <br>
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 400; display: block; margin-top: 2px; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                Números: ${nums}
            </span>`;
        }
    }
}

// ─── Limpar modo de seleção ────────────────────────────────────────────────
function limparModoSelecao() {
    modoSelecaoAtivo = false;
    numerosSelecionadosList = [];

    // Remover highlight de todos os elementos
    Object.values(elementosGrid).forEach(el => el && el.classList.remove("selected-temp"));

    const footer = document.getElementById("footer-selecao-flutuante");
    if (footer) footer.classList.remove("show");

    const btnModo = document.getElementById("btn-modo-selecao");
    if (btnModo) {
        btnModo.style.background = "";
        btnModo.style.color = "";
        btnModo.style.borderColor = "";
        btnModo.querySelector("span").textContent = "Selecionar Vários";
    }
}

// ─── Modal de Lote Helpers ──────────────────────────────────────────────────
function abrirModalFinalizarLote() {
    const modalLote = document.getElementById("modal-finalizar-lote");
    if (!modalLote) return;

    const textNumeros = document.getElementById("lote-numeros-lista");
    const textQtd = document.getElementById("lote-qtd-total");
    const textValor = document.getElementById("lote-valor-total");
    const inputNome = document.getElementById("lote-nome");
    const selectVendedor = document.getElementById("lote-vendedor");
    const selectPagamento = document.getElementById("lote-tipo-pagamento");
    const gpChavePix = document.getElementById("lote-grupo-chave-pix");
    const inputObs = document.getElementById("lote-obs");

    const qtd = numerosSelecionadosList.length;
    const nums = numerosSelecionadosList.map(n => formatarNumero(n)).join(", ");
    const total = qtd * VALOR_NUMERO;

    if (textNumeros) textNumeros.textContent = nums;
    if (textQtd) textQtd.textContent = qtd;
    if (textValor) textValor.textContent = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    if (inputNome) {
        inputNome.value = userDisplayName || (currentUser ? currentUser.email : "");
        if (userRole !== "admin" && currentUser) {
            inputNome.disabled = true;
        } else {
            inputNome.disabled = false;
        }
    }

    if (inputObs) inputObs.value = "";
    if (selectPagamento) {
        selectPagamento.value = "dinheiro";
    }
    if (gpChavePix) gpChavePix.style.display = "none";

    // Preenche vendedores
    popularSelectVendedores(selectVendedor);

    // Setup select change do PIX no modal de lote
    if (selectPagamento && gpChavePix) {
        selectPagamento.onchange = () => {
            gpChavePix.style.display = selectPagamento.value === "pix" ? "block" : "none";
        };
    }

    modalLote.style.display = "flex";
}

function fecharModalLote() {
    const modalLote = document.getElementById("modal-finalizar-lote");
    if (modalLote) modalLote.style.display = "none";
}

window.fecharModalLote = fecharModalLote;

// Inicializar eventos DOM
document.addEventListener("DOMContentLoaded", () => {
    // ── PIX copy modal individual ──────────────────────────────────────────
    const selectPagamento = document.getElementById("tipo-pagamento");
    const gpChavePix = document.getElementById("grupo-chave-pix");
    const btnCopiarPix = document.getElementById("btn-copiar-pix");
    const inputChavePix = document.getElementById("chave-pix-copiar");

    if (selectPagamento && gpChavePix) {
        selectPagamento.onchange = () => {
            gpChavePix.style.display = selectPagamento.value === "pix" ? "block" : "none";
        };
    }

    if (btnCopiarPix && inputChavePix) {
        btnCopiarPix.onclick = () => {
            navigator.clipboard.writeText(inputChavePix.value)
                .then(() => exibirNotificacao("Chave PIX copiada com sucesso!", "success"))
                .catch(err => exibirNotificacao("Erro ao copiar chave: " + err, "error"));
        };
    }

    // ── PIX copy modal de lote ──────────────────────────────────────────────
    const btnCopiarPixLote = document.getElementById("lote-btn-copiar-pix");
    const inputChavePixLote = document.getElementById("lote-chave-pix-copiar");

    if (btnCopiarPixLote && inputChavePixLote) {
        btnCopiarPixLote.onclick = () => {
            navigator.clipboard.writeText(inputChavePixLote.value)
                .then(() => exibirNotificacao("Chave PIX copiada com sucesso!", "success"))
                .catch(err => exibirNotificacao("Erro ao copiar chave: " + err, "error"));
        };
    }

    // ── Botão Selecionar Vários ───────────────────────────────────────────
    const btnModo = document.getElementById("btn-modo-selecao");
    if (btnModo) {
        btnModo.onclick = () => {
            modoSelecaoAtivo = !modoSelecaoAtivo;
            if (modoSelecaoAtivo) {
                btnModo.style.background = "var(--color-primary)";
                btnModo.style.color = "white";
                btnModo.style.borderColor = "var(--color-primary)";
                btnModo.querySelector("span").textContent = "Cancelar Seleção";
                exibirNotificacao("Modo seleção ativado. Toque nos números disponíveis.", "info");
            } else {
                limparModoSelecao();
            }
        };
    }

    // ── Botão Finalizar Reserva em lote → Abre modal de finalização de lote ─
    const btnFinalizar = document.getElementById("btn-finalizar-selecao");
    if (btnFinalizar) {
        btnFinalizar.onclick = () => {
            if (numerosSelecionadosList.length === 0) return;
            if (!supabaseClient) {
                exibirNotificacao("Banco de dados não conectado.", "error");
                return;
            }
            if (!currentUser) {
                exibirNotificacao("Você precisa estar logado para reservar.", "warning");
                return;
            }

            abrirModalFinalizarLote();
        };
    }

    // ── Botão Confirmar Reserva do modal de lote ────────────────────────────
    const btnLoteSalvar = document.getElementById("lote-salvar");
    if (btnLoteSalvar) {
        btnLoteSalvar.onclick = async () => {
            const inputNome = document.getElementById("lote-nome");
            const selectVendedor = document.getElementById("lote-vendedor");
            const selectPagamento = document.getElementById("lote-tipo-pagamento");
            const inputObs = document.getElementById("lote-obs");

            const nome = inputNome ? inputNome.value.trim() : "";
            const vendedorNome = selectVendedor ? selectVendedor.value : "";
            const formaPagamento = selectPagamento ? selectPagamento.value : "dinheiro";
            const obsAdicional = inputObs ? inputObs.value.trim() : "";

            if (!nome) {
                exibirNotificacao("Preencha o nome do comprador.", "warning");
                return;
            }
            if (!vendedorNome) {
                exibirNotificacao("Selecione com quem você comprou os números.", "warning");
                return;
            }

            // Inicia spinner no botão de lote
            const spinner = document.getElementById("lote-salvar-spinner");
            const textoEl = document.getElementById("lote-salvar-texto");
            if (spinner) spinner.style.display = "inline-block";
            if (textoEl) textoEl.textContent = "Salvando...";
            btnLoteSalvar.disabled = true;

            const tags = `[Lote] [Pgmto: ${formaPagamento.toUpperCase()}] [Vendedor: ${vendedorNome}]`;
            const obs = obsAdicional ? `${tags} ${obsAdicional}` : tags;

            let salvos = 0;
            let erros = 0;

            try {
                // Salvar cada número no banco
                for (const num of numerosSelecionadosList) {
                    if (rifasData[num]) continue; // já reservado, pular
                    const { error } = await supabaseClient
                        .from("rifas")
                        .insert({
                            numero: num,
                            nome: nome,
                            observacao: obs,
                            user_id: currentUser ? currentUser.id : null
                        });
                    if (error) { erros++; } else { salvos++; }
                }

                if (erros > 0) {
                    exibirNotificacao(`${salvos} número(s) reservado(s), ${erros} já ocupado(s).`, "warning");
                } else {
                    exibirNotificacao(`${salvos} número(s) reservado(s) com sucesso! Abrindo WhatsApp...`, "success");
                }

                // Montar e abrir WhatsApp com o vendedor correto
                const nums = numerosSelecionadosList.map(n => formatarNumero(n)).join(", ");
                const qtd = numerosSelecionadosList.length;
                const valorTotal = (qtd * VALOR_NUMERO).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

                const vendedorObj = VENDEDORES.find(v => v.nome === vendedorNome) || VENDEDORES[0];
                const waNumber = vendedorObj.whatsapp;

                const msg = `Olá ${vendedorObj.nome}! Quero confirmar minha reserva em lote na Rifa Terceirão 🎟️\n\n*Nome:* ${nome}\n*Números:* ${nums}\n*Quantidade:* ${qtd}\n*Pagamento:* ${formaPagamento.toUpperCase()}\n*Valor Total:* ${valorTotal}${obsAdicional ? `\nObs: ${obsAdicional}` : ""}\n\n👉 *Estou enviando o comprovante do PIX em anexo!* 📎`;
                const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;

                fecharModalLote();
                carregarDadosBanco();
                if (window.carregarDadosAdmin) window.carregarDadosAdmin();
                if (window.carregarMeusNumeros) window.carregarMeusNumeros();
                limparModoSelecao();

                setTimeout(() => window.open(url, "_blank"), 600);

            } catch (error) {
                exibirNotificacao("Erro ao salvar reservas: " + error.message, "error");
            } finally {
                if (spinner) spinner.style.display = "none";
                if (textoEl) textoEl.textContent = "Confirmar e Enviar no WhatsApp";
                btnLoteSalvar.disabled = false;
            }
        };
    }
});
