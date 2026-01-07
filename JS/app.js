/**
 * CookShare Cloud Logic
 * Architecture: Azure Logic Apps + Cosmos DB + Blob Storage
 */

// --- 1. CONFIGURATION (Logic App Trigger URLs) ---
const URL_READ   = "https://prod-20.francecentral.logic.azure.com:443/workflows/97adc7bda82940938131373870d1d893/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5cIjL8PPtplu1RnkzyMz0eA-rmqz-uHWp4xH2XDLYqs";
const URL_CREATE = "https://prod-12.francecentral.logic.azure.com:443/workflows/8a1b2b512a5b4d87a2e940a22ab794da/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=b-CxHzyro6WTRaa9a5LsKT40srSikqolXrgxJDbpTnk";
const URL_UPDATE = "https://prod-14.francecentral.logic.azure.com:443/workflows/6c9e58a2552e4733996937ade1cca4b8/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=w-NkxLk_v7PMj0f7EuYzMLQ8g33IXCmh_AYl8giWH_Y";
const URL_DELETE = "https://prod-11.francecentral.logic.azure.com:443/workflows/01b6cf7b497448ba83d48adf64c38635/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=GfCmwiYnoN_3kDK1PhbVIxRyR-voqPGaVNfh3gidbWg";
const URL_BLOB   = "https://prod-03.francecentral.logic.azure.com:443/workflows/d68ea661e2a34b768a39d2ad471a4205/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F1A9O71T_yq9R5yw-TKA9vw6s7usxGcRYcNV3KFrf_c";

// Fallback for missing images
const DEFAULT_IMG = "https://stcookshareshazin.blob.core.windows.net/media/default-recipe.jpg";

// --- 2. INITIALIZATION ---
$(document).ready(function() {
    fetchAll();
});

// --- 3. UTILITY FUNCTIONS ---

/**
 * Converts Azure Cosmos DB _ts (unix timestamp) to human readable format
 */
function formatTime(unixTimestamp) {
    if(!unixTimestamp) return "Recently Uploaded";
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Sanitizes strings for use in HTML onclick attributes to prevent JS crashes
 */
function cleanString(str) {
    if (!str) return "";
    return String(str)
        .replace(/'/g, "\\'")   // Escape single quotes
        .replace(/\n/g, " ")    // Replace newlines with spaces
        .replace(/\r/g, " ");   // Replace carriage returns
}

// --- 4. CORE CRUD OPERATIONS ---

// READ: Fetch all recipes from Azure
async function fetchAll() {
    try {
        const response = await fetch(URL_READ);
        const data = await response.json();
        renderRecipes(data);
    } catch (e) {
        console.error("Fetch Error:", e);
        $("#gallery").html("<div class='col-12 text-center'><p class='text-danger'>Unable to load recipes. Check CORS settings.</p></div>");
    }
}

// CREATE: Upload image to Blob and Metadata to Cosmos DB
async function uploadRecipe() {
    const fileInput = document.getElementById("recipeImage");
    let finalImageUrl = DEFAULT_IMG;
    $("#status").html("<span class='text-info'>⏳ Processing Cloud Upload...</span>");

    try {
        // Upload image if selected
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            const base64Content = await new Promise(resolve => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });

            const blobRes = await fetch(URL_BLOB, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileName: file.name, fileContent: base64Content })
            });
            const blobData = await blobRes.json();
            finalImageUrl = blobData.imageUrl;
        }

        // Save metadata to Cosmos DB
        const recipeData = {
            id: "recipe-" + Date.now(),
            userId: "user-789", // Fixed Partition Key for this demo
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
            alert("Recipe Saved to Azure Cloud!");
            location.reload();
        }
    } catch (e) {
        $("#status").html("<span class='text-danger'>❌ Upload Failed.</span>");
    }
}

// UPDATE: Send modified data back to Azure (Upsert)
async function submitUpdate() {
    const updatedData = {
        id: $("#edit-id").val(),
        userId: $("#edit-userId").val(),
        imageUrl: $("#edit-imageUrl").val(), // Preserves the original photo
        title: $("#edit-title").val(),
        ingredients: $("#edit-ingredients").val(),
        steps: $("#edit-steps").val()
    };

    try {
        const res = await fetch(URL_UPDATE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData)
        });

        if (res.ok) {
            alert("Update Successful!");
            location.reload();
        }
    } catch (e) {
        alert("Update failed. Check Logic App.");
    }
}

// DELETE: Remove record from Cosmos DB
async function deleteRecipe(id, userId) {
    if (!confirm("Are you sure you want to delete this recipe permanently from the cloud?")) return;

    try {
        await fetch(URL_DELETE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: String(id), userId: String(userId) })
        });
        fetchAll(); // Refresh the gallery
    } catch (e) {
        alert("Delete failed.");
    }
}

// --- 5. MODAL LOGIC ---

// Open detailed View Modal
function viewRecipe(title, ingredients, steps, imageUrl, userId, ts) {
    $("#view-title").text(title);
    $("#view-ingredients").text(ingredients);
    $("#view-steps").text(steps);
    $("#view-user").text(userId);
    $("#view-time").text(formatTime(ts));
    $("#view-image").attr("src", imageUrl || DEFAULT_IMG);

    const viewModal = new bootstrap.Modal(document.getElementById('viewModal'));
    viewModal.show();
}

// Open Edit Modal and pre-fill fields
function editRecipe(id, userId, title, ingredients, steps, imageUrl) {
    $("#edit-id").val(id);
    $("#edit-userId").val(userId);
    $("#edit-imageUrl").val(imageUrl); // Hidden field to carry image URL forward
    
    $("#edit-title").val(title);
    $("#edit-ingredients").val(ingredients);
    $("#edit-steps").val(steps);

    const editModal = new bootstrap.Modal(document.getElementById('updateModal'));
    editModal.show();
}

// --- 6. RENDERING ENGINE ---

function renderRecipes(data) {
    const gallery = $("#gallery");
    gallery.empty();

    if (!data || data.length === 0) {
        gallery.html("<div class='col-12 text-center'><p>No recipes found.</p></div>");
        return;
    }

    // Newest first
    data.reverse().forEach(recipe => {
        // Sanitize all text for the onclick attributes
        const sT = cleanString(recipe.title);
        const sI = cleanString(recipe.ingredients);
        const sS = cleanString(recipe.steps);
        const img = recipe.imageUrl || DEFAULT_IMG;
        const ts = recipe._ts || 0;

        // Determine if we show Admin Buttons (Portal only)
        let adminButtons = '';
        if (window.location.pathname.endsWith('portal.html')) {
            adminButtons = `
                <div class="mt-3 text-center border-top pt-2">
                    <button class="btn btn-warning btn-sm me-1" 
                        onclick="editRecipe('${recipe.id}', '${recipe.userId}', '${sT}', '${sI}', '${sS}', '${img}')">Edit</button>
                    <button class="btn btn-danger btn-sm" 
                        onclick="deleteRecipe('${recipe.id}', '${recipe.userId}')">Delete</button>
                </div>`;
        }

        // Build 3-column grid card
        gallery.append(`
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm border-0">
                    <div style="cursor:pointer;" onclick="viewRecipe('${sT}', '${sI}', '${sS}', '${img}', '${recipe.userId}', ${ts})">
                        <img src="${img}" class="card-img-top" style="height:180px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
                        <div class="card-body pb-0">
                            <h6 class="card-title fw-bold mb-1">${recipe.title || "Untitled"}</h6>
                            <p class="text-muted small mb-2">🕒 ${formatTime(ts)}</p>
                            <p class="card-text small text-muted">${sI.substring(0, 60)}...</p>
                        </div>
                    </div>
                    <div class="card-body pt-0">
                        ${adminButtons}
                    </div>
                </div>
            </div>`);
    });
}