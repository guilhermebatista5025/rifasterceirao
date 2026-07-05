/*****************************************************************
 * ADMIN PANEL LOGIC - js/admin.js
 *****************************************************************/

async function carregarDadosAdmin() {
    // Se o banco não estiver configurado, redireciona para a home
    if (!supabaseClient) {
        exibirNotificacao("Banco de dados Supabase não conectado. Redirecionando...", "warning");
        window.location.href = "../index.html";
        return;
    }

    // Verificar se o usuário é realmente administrador. Caso contrário, redireciona.
    if (userRole !== 'admin') {
        exibirNotificacao("Acesso negado. Apenas administradores podem ver esta página.", "warning");
        window.location.href = "../index.html";
        return;
    }

    const tbodyVendas = document.getElementById("lista-admin-vendas");
    const tbodyUsers = document.getElementById("lista-admin-usuarios");

    tbodyVendas.innerHTML = `<tr><td colspan="5" class="empty-state">Carregando vendas...</td></tr>`;
    tbodyUsers.innerHTML = `<tr><td colspan="3" class="empty-state">Carregando usuários...</td></tr>`;

    try {
        // 1. Carregar Todas as Vendas com Perfil (Excluindo a linha de config com numero=0)
        const { data: vendas, error: errVendas } = await supabaseClient
            .from("rifas")
            .select("*, profiles(full_name)")
            .gt("numero", 0)
            .order("numero");

        if (errVendas) throw errVendas;

        tbodyVendas.innerHTML = "";

        if (!vendas || vendas.length === 0) {
            tbodyVendas.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma venda registrada.</td></tr>`;
        } else {
            vendas.forEach(venda => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><span class="badge-numero">${formatarNumero(venda.numero)}</span></td>
                    <td><strong>${venda.profiles?.full_name || venda.nome}</strong></td>
                    <td>${formatarData(venda.created_at)}</td>
                    <td>${venda.observacao || "-"}</td>
                    <td>
                        <button class="btn-primary btn-action-small" onclick="abrirDetalhesNumero(${venda.numero})">Editar</button>
                    </td>
                `;
                tbodyVendas.appendChild(tr);
            });
        }

        // 2. Carregar Lista de Usuários
        const { data: allUsers, error: errUsers } = await supabaseClient
            .from("profiles")
            .select("*")
            .order("full_name");

        if (errUsers) throw errUsers;

        tbodyUsers.innerHTML = "";

        const admins = allUsers ? allUsers.filter(u => u.role === 'admin') : [];

        if (admins.length === 0) {
            tbodyUsers.innerHTML = `<tr><td colspan="4" class="empty-state">Nenhum administrador cadastrado.</td></tr>`;
        } else {
            admins.forEach(u => {
                const tr = document.createElement("tr");
                const badgeRole = u.role === 'admin' ? 'badge-admin' : 'badge-user';
                tr.innerHTML = `
                    <td><strong>${u.full_name}</strong></td>
                    <td class="text-muted" style="font-size:12px;">ID: ${u.id.substring(0, 8)}...</td>
                    <td>
                        <span class="badge ${badgeRole}">
                            ${u.role}
                        </span>
                    </td>
                    <td>
                        <button class="btn-danger" onclick="toggleUserRole('${u.id}', '${u.role}')" style="padding: 6px 12px; font-size: 12px; height: auto; border-radius: var(--radius-sm);">
                            <i class="fa-solid fa-user-minus"></i> Remover Admin
                        </button>
                    </td>
                `;
                tbodyUsers.appendChild(tr);
            });
        }

        // Salvar em cache para busca local no formulário de promoção
        window.allUsersCached = allUsers;

        // Popular select de lançamento em lote
        const selectLoteUsuario = document.getElementById("lote-usuario");
        if (selectLoteUsuario) {
            selectLoteUsuario.innerHTML = '<option value="">Sem conta (Convidado)</option>';
            if (allUsers) {
                allUsers.forEach(u => {
                    const opt = document.createElement("option");
                    opt.value = u.id;
                    opt.textContent = `${u.full_name} (${u.role})`;
                    selectLoteUsuario.appendChild(opt);
                });
            }
        }

        // Popular datalist para autocomplete do input de administrador
        const datalist = document.getElementById("usuarios-sugeridos");
        if (datalist) {
            datalist.innerHTML = "";
            if (allUsers) {
                allUsers.forEach(u => {
                    const opt = document.createElement("option");
                    // Se o usuário tiver e-mail cadastrado em profiles, usa e-mail. Caso contrário, usa o nome ou ID.
                    opt.value = u.email || u.full_name || u.id;
                    opt.textContent = `${u.full_name} (${u.role})`;
                    datalist.appendChild(opt);
                });
            }
        }

        // 3. Atualizar Indicadores Específicos do Admin
        const totalVendas = vendas ? vendas.length : 0;
        const totalUsers = allUsers ? allUsers.length : 0;
        const arrecadado = totalVendas * VALOR_NUMERO;
        const percentual = ((totalVendas / TOTAL_NUMEROS) * 100).toFixed(1);

        document.getElementById("admin-arrecadado").textContent = arrecadado.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
        document.getElementById("admin-vendidos").textContent = `${totalVendas} / ${TOTAL_NUMEROS}`;
        document.getElementById("admin-percentual").textContent = `${percentual}%`;
        document.getElementById("admin-total-usuarios").textContent = totalUsers;

        // Configurar Barra de Pesquisa de Admin
        const buscaAdmin = document.getElementById("busca-admin-vendas");
        if (buscaAdmin) {
            buscaAdmin.oninput = () => {
                const filterText = buscaAdmin.value.toLowerCase().trim();
                const rows = tbodyVendas.getElementsByTagName("tr");

                for (let row of rows) {
                    if (row.cells.length < 5) continue;
                    const num = row.cells[0].textContent.toLowerCase();
                    const nome = row.cells[1].textContent.toLowerCase();
                    const obs = row.cells[3].textContent.toLowerCase();

                    if (num.includes(filterText) || nome.includes(filterText) || obs.includes(filterText)) {
                        row.style.display = "";
                    } else {
                        row.style.display = "none";
                    }
                }
            };
        }

    } catch (error) {
        console.error("Erro no admin load:", error);
        const statusBanner = document.getElementById("status-banner");
        if (statusBanner) statusBanner.style.display = "block";
    }
}

// Alternar papel do usuário (User / Admin)
async function toggleUserRole(userId, currentRole) {
    if (userId === currentUser.id) {
        exibirNotificacao("Você não pode alterar seu próprio papel.", "warning");
        return;
    }

    const novaRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Deseja alterar o papel deste usuário para ${novaRole.toUpperCase()}?`)) return;

    try {
        const { error } = await supabaseClient
            .from("profiles")
            .update({ role: novaRole })
            .eq("id", userId);

        if (error) throw error;

        exibirNotificacao(`Papel atualizado para ${novaRole.toUpperCase()}!`, "success");
        carregarDadosAdmin();
    } catch (error) {
        exibirNotificacao("Erro ao alterar papel: " + error.message, "error");
    }
}

// Exportar Vendas como CSV
async function exportarVendasCSV() {
    if (!supabaseClient) return;

    try {
        const { data: vendas, error } = await supabaseClient
            .from("rifas")
            .select("*, profiles(full_name)")
            .gt("numero", 0)
            .order("numero");

        if (error) throw error;

        if (!vendas || vendas.length === 0) {
            exibirNotificacao("Não há vendas para exportar.", "warning");
            return;
        }

        let csvContent = "\uFEFF"; // BOM para acentuação correta no Excel brasileiro
        csvContent += "Numero;Comprador;Data;Observacao;Valor\n";

        vendas.forEach(v => {
            const numero = formatarNumero(v.numero);
            const comprador = v.profiles?.full_name || v.nome;
            const data = formatarData(v.created_at);
            const obs = (v.observacao || "").replace(/;/g, ",");
            const valor = `R$ ${VALOR_NUMERO.toFixed(2)}`;

            csvContent += `${numero};${comprador};${data};${obs};${valor}\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `vendas_rifa_terceirao_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        exibirNotificacao("Erro ao exportar CSV: " + error.message, "error");
    }
}

// Zerar Rifa (Limpar reservas do banco de dados)
async function zerarRifa() {
    if (!supabaseClient || userRole !== 'admin') return;

    const confirmacao1 = confirm("⚠️ ATENÇÃO: Isso irá apagar TODAS as reservas e vendas cadastradas no banco de dados! Deseja continuar?");
    if (!confirmacao1) return;

    const confirmacao2 = prompt("Para confirmar a exclusão de todas as rifas, digite o nome de usuário ativo:");
    if (confirmacao2 !== userDisplayName) {
        exibirNotificacao("Confirmação incorreta. Ação abortada.", "warning");
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("rifas")
            .delete()
            .gt("numero", 0);

        if (error) throw error;

        exibirNotificacao("Todas as rifas foram excluídas com sucesso!", "success");
        window.location.href = "../index.html"; // Redireciona para a página principal

    } catch (error) {
        exibirNotificacao("Erro ao zerar as rifas: " + error.message, "error");
    }
}

// Lançamento rápido em Lote
async function lancarReservaLote() {
    if (!supabaseClient) return;

    const nome = document.getElementById("lote-nome").value.trim();
    const userId = document.getElementById("lote-usuario").value || null;
    const telefone = document.getElementById("lote-telefone").value.trim();
    const turma = document.getElementById("lote-turma").value.trim();
    const numerosRaw = document.getElementById("lote-numeros").value.trim();
    const obs = document.getElementById("lote-obs").value.trim();

    // Combinar observações, telefone e turma
    let finalObs = obs;
    const extraInfo = [];
    if (telefone) extraInfo.push(`Tel: ${telefone}`);
    if (turma) extraInfo.push(`Turma: ${turma}`);
    
    if (extraInfo.length > 0) {
        const infoStr = extraInfo.join(" | ");
        finalObs = finalObs ? `${finalObs} | ${infoStr}` : infoStr;
    }

    if (!nome) {
        exibirNotificacao("Por favor, informe o nome do comprador.", "warning");
        return;
    }

    if (!numerosRaw) {
        exibirNotificacao("Por favor, digite pelo menos um número de rifa.", "warning");
        return;
    }

    // Processar os números (separar por vírgulas, remover espaços)
    const numeros = numerosRaw.split(",")
        .map(n => parseInt(n.trim(), 10))
        .filter(n => !isNaN(n) && n >= 1 && n <= TOTAL_NUMEROS);

    if (numeros.length === 0) {
        exibirNotificacao("Nenhum número de rifa válido informado (valores permitidos: 1 a 2000).", "error");
        return;
    }

    try {
        // Validar se algum número já está reservado
        const { data: jaReservados, error: errCheck } = await supabaseClient
            .from("rifas")
            .select("numero")
            .in("numero", numeros);

        if (errCheck) throw errCheck;

        const setReservados = new Set(jaReservados ? jaReservados.map(r => r.numero) : []);
        const numerosDisponiveis = numeros.filter(n => !setReservados.has(n));

        if (numerosDisponiveis.length === 0) {
            exibirNotificacao(`Erro: Todos os números informados (${numeros.join(", ")}) já estão reservados por outros compradores!`, "error");
            return;
        }

        // Criar as linhas de insert
        const inserts = numerosDisponiveis.map(n => ({
            numero: n,
            nome: nome,
            observacao: finalObs || null,
            user_id: userId
        }));

        const { error: errInsert } = await supabaseClient
            .from("rifas")
            .insert(inserts);

        if (errInsert) throw errInsert;

        // Limpar campos
        document.getElementById("lote-nome").value = "";
        document.getElementById("lote-usuario").value = "";
        document.getElementById("lote-telefone").value = "";
        document.getElementById("lote-turma").value = "";
        document.getElementById("lote-numeros").value = "";
        document.getElementById("lote-obs").value = "";

        // Fechar modal
        const modalLote = document.getElementById("modal-lote");
        if (modalLote) modalLote.style.display = "none";

        let mensagem = `Sucesso! Reservado(s) ${numerosDisponiveis.length} número(s) para ${nome}.`;
        if (setReservados.size > 0) {
            const listPulados = Array.from(setReservados).join(", ");
            mensagem += `\n⚠️ Os seguintes números já estavam ocupados e foram pulados: ${listPulados}`;
        }

        exibirNotificacao(mensagem, "success");

        if (window.carregarDadosBanco) window.carregarDadosBanco();
        carregarDadosAdmin();

    } catch (error) {
        exibirNotificacao("Erro ao lançar reserva em lote: " + error.message, "error");
    }
}

// Gerenciamento do Modal de Lançamento em Lote
function setupLoteModal() {
    const modalLote = document.getElementById("modal-lote");
    const btnAbrir = document.getElementById("btn-lote-abrir");
    const btnFechar = document.getElementById("btn-fechar-lote");
    const btnCancelar = document.getElementById("btn-cancelar-lote");

    if (!modalLote) return;

    function abrir() {
        // Reset campos ao abrir
        document.getElementById("lote-nome").value = "";
        document.getElementById("lote-usuario").value = "";
        document.getElementById("lote-telefone").value = "";
        document.getElementById("lote-turma").value = "";
        document.getElementById("lote-numeros").value = "";
        document.getElementById("lote-obs").value = "";
        modalLote.style.display = "flex";
    }

    function fechar() {
        modalLote.style.display = "none";
    }

    if (btnAbrir) btnAbrir.onclick = abrir;
    if (btnFechar) btnFechar.onclick = fechar;
    if (btnCancelar) btnCancelar.onclick = fechar;

    // Fechar ao clicar fora do modal
    window.addEventListener("click", (e) => {
        if (e.target === modalLote) fechar();
    });
}

// Configurar quantidade de rifas no admin
function setupConfigRifasAdmin() {
    const inputTotal = document.getElementById("admin-total-rifas-input");
    const btnSalvar = document.getElementById("btn-salvar-total-rifas");

    if (!inputTotal || !btnSalvar) return;

    // Carregar valor atual
    inputTotal.value = TOTAL_NUMEROS;

    btnSalvar.onclick = async () => {
        const totalVal = parseInt(inputTotal.value, 10);
        if (isNaN(totalVal) || totalVal <= 0) {
            exibirNotificacao("Quantidade de rifas inválida.", "error");
            return;
        }

        let salvoNoBanco = false;

        // 1. Tentar salvar na tabela 'config'
        try {
            const { error } = await supabaseClient
                .from("config")
                .upsert({ key: "total_rifas", value: totalVal.toString() });

            if (!error) {
                salvoNoBanco = true;
                console.log("Configurações salvas na tabela config do banco.");
            }
        } catch (e) {}

        // 2. Se falhar ou a tabela config não existir, tenta salvar na tabela 'rifas' com numero = 0
        if (!salvoNoBanco && supabaseClient) {
            try {
                const { data: existe } = await supabaseClient
                    .from("rifas")
                    .select("numero")
                    .eq("numero", 0)
                    .single();

                if (existe) {
                    const { error } = await supabaseClient
                        .from("rifas")
                        .update({ nome: "config_total_rifas", observacao: totalVal.toString() })
                        .eq("numero", 0);
                    if (!error) salvoNoBanco = true;
                } else {
                    const { error } = await supabaseClient
                        .from("rifas")
                        .insert({ numero: 0, nome: "config_total_rifas", observacao: totalVal.toString() });
                    if (!error) salvoNoBanco = true;
                }
                if (salvoNoBanco) {
                    console.log("Configurações salvas na tabela rifas com numero = 0.");
                }
            } catch (e) {
                console.error("Erro ao salvar no fallback do banco:", e);
            }
        }

        localStorage.setItem("total_numeros", totalVal.toString());
        TOTAL_NUMEROS = totalVal;

        // Re-renderizar o grid e os dados imediatamente
        if (window.gerarGridNumeros) window.gerarGridNumeros();
        if (window.carregarDadosBanco) window.carregarDadosBanco();
        carregarDadosAdmin();

        if (salvoNoBanco) {
            exibirNotificacao("Quantidade total de rifas atualizada no banco de dados!", "success");
        } else {
            exibirNotificacao("Quantidade total de rifas salva localmente (erro ao sincronizar com banco de dados).", "warning");
        }
    };
}

// Promover usuário a administrador por ID, E-mail ou Nome
async function promoverUsuarioAdmin() {
    if (!supabaseClient) return;

    const inputId = document.getElementById("admin-add-id");
    if (!inputId) return;

    const inputValue = inputId.value.trim();
    if (!inputValue) {
        exibirNotificacao("Por favor, insira o ID, E-mail ou Nome do usuário.", "warning");
        return;
    }

    let targetUserId = null;
    let targetUserName = "Administrador Convidado";

    // 1. Tentar resolver localmente a partir da cache de usuários carregados
    if (window.allUsersCached) {
        const found = window.allUsersCached.find(u => 
            u.id === inputValue || 
            (u.email && u.email.toLowerCase() === inputValue.toLowerCase()) || 
            u.full_name.toLowerCase() === inputValue.toLowerCase()
        );

        if (found) {
            targetUserId = found.id;
            targetUserName = found.full_name;
        }
    }

    // 2. Se não encontrou na cache, tenta verificar se o input é um UUID válido ou busca no banco
    if (!targetUserId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(inputValue)) {
            targetUserId = inputValue;
        } else {
            // Tenta buscar no banco de dados pela coluna 'email'
            try {
                const { data: userByEmail } = await supabaseClient
                    .from("profiles")
                    .select("id, full_name")
                    .eq("email", inputValue)
                    .maybeSingle();

                if (userByEmail) {
                    targetUserId = userByEmail.id;
                    targetUserName = userByEmail.full_name;
                }
            } catch (e) {
                console.warn("Erro ao buscar usuário por e-mail no banco de dados:", e);
            }
        }
    }

    if (!targetUserId) {
        exibirNotificacao("Usuário não encontrado. Digite o E-mail completo ou ID (UUID).", "error");
        return;
    }

    try {
        // Verificar se o usuário existe na tabela profiles
        const { data: user, error: errFetch } = await supabaseClient
            .from("profiles")
            .select("full_name, role")
            .eq("id", targetUserId)
            .maybeSingle();

        if (errFetch || !user) {
            // Se o perfil não existir na tabela profiles, cria um perfil administrativo
            const confirmacao = confirm(`O ID de usuário "${targetUserId}" não possui um perfil ativo no banco. Deseja criar um perfil administrativo para ele?`);
            if (!confirmacao) return;

            const { error: errInsert } = await supabaseClient
                .from("profiles")
                .insert({
                    id: targetUserId,
                    full_name: targetUserName,
                    role: 'admin'
                });

            if (errInsert) throw errInsert;

            exibirNotificacao(`Perfil administrativo criado com sucesso para ${targetUserName}!`, "success");
            inputId.value = "";
            carregarDadosAdmin();
            return;
        }

        if (user.role === 'admin') {
            exibirNotificacao(`O usuário ${user.full_name} já é um administrador.`, "info");
            return;
        }

        // Atualizar o papel para admin
        const { error: errUpdate } = await supabaseClient
            .from("profiles")
            .update({ role: 'admin' })
            .eq("id", targetUserId);

        if (errUpdate) throw errUpdate;

        exibirNotificacao(`Sucesso! ${user.full_name} foi promovido a Administrador.`, "success");
        inputId.value = "";
        
        // Recarregar os dados
        carregarDadosAdmin();

    } catch (error) {
        exibirNotificacao("Erro ao promover usuário: " + error.message, "error");
    }
}

// Ativar botões admin
document.addEventListener("DOMContentLoaded", () => {
    const btnExportar = document.getElementById("btn-exportar-csv");
    const btnZerar = document.getElementById("btn-zerar-vendas");
    const btnLancarLote = document.getElementById("btn-lancar-lote");
    const btnAddAdmin = document.getElementById("btn-add-admin");

    if (btnExportar) btnExportar.onclick = exportarVendasCSV;
    if (btnZerar) btnZerar.onclick = zerarRifa;
    if (btnLancarLote) btnLancarLote.onclick = lancarReservaLote;
    if (btnAddAdmin) btnAddAdmin.onclick = promoverUsuarioAdmin;

    // Configurar o modal de lote
    setupLoteModal();

    // Configurar a quantidade de rifas
    setupConfigRifasAdmin();
});

// Tornar global
window.carregarDadosAdmin = carregarDadosAdmin;
window.toggleUserRole = toggleUserRole;
window.exportarVendasCSV = exportarVendasCSV;
window.zerarRifa = zerarRifa;
window.lancarReservaLote = lancarReservaLote;
window.setupLoteModal = setupLoteModal;
window.setupConfigRifasAdmin = setupConfigRifasAdmin;
window.promoverUsuarioAdmin = promoverUsuarioAdmin;
