/*****************************************************************
 * USER PAGE LOGIC - js/user.js
 *****************************************************************/

async function carregarMeusNumeros() {
    // Se o banco não estiver configurado, redireciona para a home
    if (!supabaseClient) {
        exibirNotificacao("Banco de dados Supabase não conectado. Redirecionando...", "warning");
        window.location.href = "../index.html";
        return;
    }

    if (!currentUser) {
        exibirNotificacao("Acesso restrito. Faça login para ver esta página.", "warning");
        window.location.href = "../index.html";
        return;
    }

    const tbody = document.getElementById("lista-meus-numeros");
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Buscando seus números...</td></tr>`;

    try {
        const { data: minhasRifas, error } = await supabaseClient
            .from("rifas")
            .select("*")
            .eq("user_id", currentUser.id)
            .order("numero");

        if (error) throw error;

        tbody.innerHTML = "";

        if (!minhasRifas || minhasRifas.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Você ainda não adquiriu nenhum número.</td></tr>`;
            return;
        }

        minhasRifas.forEach(rifa => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="badge-numero">${formatarNumero(rifa.numero)}</span></td>
                <td>${formatarData(rifa.created_at)}</td>
                <td>${rifa.observacao || "-"}</td>
                <td>R$ ${VALOR_NUMERO.toFixed(2)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state error-text">Erro ao carregar números: ${error.message}</td></tr>`;
    }
}

// Tornar global
window.carregarMeusNumeros = carregarMeusNumeros;
