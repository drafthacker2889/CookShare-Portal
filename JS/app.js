// --- CONFIGURATION ---
const URL_CREATE = "https://prod-12.francecentral.logic.azure.com:443/workflows/8a1b2b512a5b4d87a2e940a22ab794da/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=b-CxHzyro6WTRaa9a5LsKT40srSikqolXrgxJDbpTnk";
const URL_READ   = "https://prod-20.francecentral.logic.azure.com:443/workflows/97adc7bda82940938131373870d1d893/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5cIjL8PPtplu1RnkzyMz0eA-rmqz-uHWp4xH2XDLYqs";
const URL_DELETE = "https://prod-11.francecentral.logic.azure.com:443/workflows/01b6cf7b497448ba83d48adf64c38635/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=GfCmwiYnoN_3kDK1PhbVIxRyR-voqPGaVNfh3gidbWg";
const URL_BLOB   = "https://prod-03.francecentral.logic.azure.com:443/workflows/d68ea661e2a34b768a39d2ad471a4205/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F1A9O71T_yq9R5yw-TKA9vw6s7usxGcRYcNV3KFrf_c";
const URL_UPDATE = "https://prod-14.francecentral.logic.azure.com:443/workflows/6c9e58a2552e4733996937ade1cca4b8/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=w-NkxLk_v7PMj0f7EuYzMLQ8g33IXCmh_AYl8giWH_Y";

// --- CREATE ---
async function uploadRecipe() {
    const fileInput = document.getElementById("recipeImage");
    let finalImageUrl = "https://placehold.co/600x400?text=No+Image";
    $("#status").html("<span class='text-info'>⏳ Uploading...</span>");

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
            userId: "user-789",
            title: $("#recipeTitle").val(),
            ingredients: $("#ingredients").val(),
            steps: $("#steps").val(),
            imageUrl: finalImageUrl
        };

        await fetch(URL_CREATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(recipeData)
        });

        location.reload();
    } catch (e) { $("#status").html("❌ Error."); }
}

// --- READ ---
async function fetchAll() {
    try {
        const response = await fetch(URL_READ);
        const data = await response.json();
        renderRecipes(data);
    } catch (e) { 
        console.error(e);
        $("#gallery").html("<p class='text-danger'>DB Scan Error. Check CORS headers.</p>"); 
    }
}

// --- UPDATE (Modal Logic) ---
function editRecipe(id, userId, title, ingredients, steps) {
    $("#edit-id").val(id);
    $("#edit-userId").val(userId);
    $("#edit-title").val(title);
    $("#edit-ingredients").val(ingredients);
    $("#edit-steps").val(steps);

    var myModal = new bootstrap.Modal(document.getElementById('updateModal'));
    myModal.show();
}

async function submitUpdate() {
    const updatedData = {
        id: $("#edit-id").val(),
        userId: $("#edit-userId").val(),
        title: $("#edit-title").val(),
        ingredients: $("#edit-ingredients").val(),
        steps: $("#edit-steps").val()
    };

    await fetch(URL_UPDATE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData)
    });
    location.reload();
}

// --- DELETE ---
async function deleteRecipe(id, userId) {
    if(!confirm("Delete permanently?")) return;
    await fetch(URL_DELETE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: String(id), userId: String(userId) })
    });
    fetchAll();
}
// --- RENDERING LOGIC ---
function renderRecipes(data) {
    const gallery = $("#gallery");
    gallery.empty();
    
    // Fallback image from your Azure Media container
    const DEFAULT_IMG = "https://stcookshareshazin.blob.core.windows.net/media/default-recipe.jpg";

    if (!data || data.length === 0) {
        gallery.html("<div class='col-12 text-center'><p>No recipes found in Azure Cosmos DB.</p></div>");
        return;
    }

    data.reverse().forEach(recipe => {
        // Safe string conversion to prevent crashes
        let sTitle = String(recipe.title || "Untitled Recipe");
        let sIng = String(recipe.ingredients || "No ingredients provided");
        let sSteps = String(recipe.steps || "No steps provided");

        // Logic: Use Azure default if no imageUrl is present
        let displayImage = (recipe.imageUrl && recipe.imageUrl.startsWith("http")) 
                           ? recipe.imageUrl 
                           : DEFAULT_IMG;

        // --- NEW: ROLE-BASED UI CHECK ---
        // --- NEW: FILENAME-SPECIFIC UI CHECK --- 
        let adminButtons = '';

        // This looks at the very end of your URL to see if the file is portal.html
        if (window.location.pathname.endsWith('portal.html')) {
            adminButtons = `
                <div class="mt-3">
                    <button class="btn btn-warning btn-sm" onclick="editRecipe('${recipe.id}', '${recipe.userId}', '${sTitle.replace(/'/g, "\\'")}', '${sIng.replace(/'/g, "\\'")}', '${sSteps.replace(/'/g, "\\'")}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRecipe('${recipe.id}', '${recipe.userId}')">Delete</button>
                </div>`;
        }

        gallery.append(`
            <div class="col-md-6 mb-3">
                <div class="card h-100 shadow-sm border-0">
                    <img src="${displayImage}" class="card-img-top" 
                         style="height:180px; object-fit:cover;" 
                         onerror="this.src='${DEFAULT_IMG}'">
                    
                    <div class="card-body">
                        <span class="badge bg-secondary mb-2">User: ${recipe.userId}</span>
                        <h5 class="card-title fw-bold">${sTitle}</h5>
                        <p class="card-text small text-muted">${sIng.substring(0, 75)}...</p>
                        ${adminButtons} </div>
                </div>
            </div>`);
    });
}

$(document).ready(fetchAll);