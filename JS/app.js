// --- CONFIGURATION ---
const URL_CREATE = "https://prod-12.francecentral.logic.azure.com:443/workflows/8a1b2b512a5b4d87a2e940a22ab794da/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=b-CxHzyro6WTRaa9a5LsKT40srSikqolXrgxJDbpTnk";
const URL_READ   = "https://prod-20.francecentral.logic.azure.com:443/workflows/97adc7bda82940938131373870d1d893/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5cIjL8PPtplu1RnkzyMz0eA-rmqz-uHWp4xH2XDLYqs";
const URL_DELETE = "https://prod-11.francecentral.logic.azure.com:443/workflows/01b6cf7b497448ba83d48adf64c38635/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=GfCmwiYnoN_3kDK1PhbVIxRyR-voqPGaVNfh3gidbWg";
const URL_BLOB   = "https://prod-03.francecentral.logic.azure.com:443/workflows/d68ea661e2a34b768a39d2ad471a4205/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F1A9O71T_yq9R5yw-TKA9vw6s7usxGcRYcNV3KFrf_c";
const URL_SEARCH = "https://prod-19.francecentral.logic.azure.com:443/workflows/07d357b027fa466d99fc52bae796316a/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=GOnhPWNFAj3YZ0k-j9jOChcU4U9YmGXnQPxZu28yTMk";

// 1. SEARCH FUNCTION (Distinction Rubric Requirement)
async function searchRecipes() {
    const term = $("#searchInput").val(); // jQuery style
    if (!term) return fetchAll();

    $("#gallery").html("<div class='text-center w-100'>Searching Cloud Database...</div>");
    try {
        const res = await fetch(URL_SEARCH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ searchTerm: term })
        });
        const results = await res.json();
        renderRecipes(results);
    } catch (e) { $("#gallery").html("Search failed."); }
}

// 2. CREATE FUNCTION (Polyglot Storage Integration)
async function uploadRecipe() {
    const fileInput = document.getElementById("recipeImage");
    let finalImageUrl = "https://placehold.co/600x400?text=No+Image+Provided";
    $("#status").html("<span class='text-info'>⏳ Uploading to Azure...</span>");

    try {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            const base64 = await new Promise(r => { reader.onload=()=>r(reader.result.split(',')[1]); reader.readAsDataURL(file); });

            const imgRes = await fetch(URL_BLOB, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: file.name, fileContent: base64 })
            });
            const imgJson = await imgRes.json();
            finalImageUrl = imgJson.imageUrl;
        }

        const recipeData = {
            id: "recipe-" + Date.now(),
            userId: "user-789", // Note: Update after CI/CD Login setup
            title: $("#recipeTitle").val(),
            ingredients: $("#ingredients").val(),
            steps: $("#steps").val(),
            imageUrl: finalImageUrl
        };

        const res = await fetch(URL_CREATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(recipeData)
        });

        if (res.ok) {
            $("#status").html("<span class='text-success'> Success! Recipe Live.</span>");
            clearForm();
            fetchAll();
        }
    } catch (e) { $("#status").html("<span class='text-danger'> Cloud connection error.</span>"); }
}

// 3. RENDER GALLERY (Shared UI logic)
function renderRecipes(data) {
    const gallery = $("#gallery");
    gallery.empty(); // jQuery
    const fallback = "https://placehold.co/600x400?text=Image+Load+Error";

    if (data.length === 0) {
        gallery.html("<div class='col-12 text-center'><p>No recipes found.</p></div>");
        return;
    }

    data.reverse().forEach(recipe => {
        gallery.append(`
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm border-primary">
                    <img src="${recipe.imageUrl || fallback}" class="card-img-top" style="height:200px; object-fit:cover;" onerror="this.src='${fallback}'">
                    <div class="card-body">
                        <span class="badge bg-secondary mb-2">Partition Key: ${recipe.userId}</span>
                        <h5 class="card-title fw-bold">${recipe.title}</h5>
                        <p class="card-text small text-muted">${recipe.ingredients}</p>
                        ${window.location.pathname.includes('portal') ? 
                          `<button class="btn btn-danger btn-sm" onclick="deleteRecipe('${recipe.id}', '${recipe.userId}')">Delete</button>` : ''}
                    </div>
                </div>
            </div>`);
    });
}

// 4. GLOBAL FETCH & DELETE
async function fetchAll() {
    try {
        const response = await fetch(URL_READ);
        const data = await response.json();
        renderRecipes(data);
    } catch (e) { $("#gallery").html("DB Scan Error."); }
}

async function deleteRecipe(id, userId) {
    if(!confirm("Remove document permanently from Cosmos DB?")) return;
    try {
        await fetch(URL_DELETE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: String(id), userId: String(userId) })
        });
        fetchAll();
    } catch (e) { alert("Delete failed."); }
}

function clearForm() {
    $("#recipeTitle").val("");
    $("#ingredients").val("");
    $("#steps").val("");
}

$(document).ready(fetchAll); // jQuery Page Load