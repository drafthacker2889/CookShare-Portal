/**
 * CookShare Integrated Cloud Logic - Final Production Version
 * Architecture: Azure Logic Apps + Cosmos DB + Blob Storage + SWA Auth
 */

// --- 1. CONFIGURATION (Logic App Trigger URLs) ---
const URL_READ   = "https://prod-20.francecentral.logic.azure.com:443/workflows/97adc7bda82940938131373870d1d893/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=5cIjL8PPtplu1RnkzyMz0eA-rmqz-uHWp4xH2XDLYqs";
const URL_CREATE = "https://prod-12.francecentral.logic.azure.com:443/workflows/8a1b2b512a5b4d87a2e940a22ab794da/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=b-CxHzyro6WTRaa9a5LsKT40srSikqolXrgxJDbpTnk";
const URL_UPDATE = "https://prod-14.francecentral.logic.azure.com:443/workflows/6c9e58a2552e4733996937ade1cca4b8/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=w-NkxLk_v7PMj0f7EuYzMLQ8g33IXCmh_AYl8giWH_Y";
const URL_DELETE = "https://prod-11.francecentral.logic.azure.com:443/workflows/01b6cf7b497448ba83d48adf64c38635/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=GfCmwiYnoN_3kDK1PhbVIxRyR-voqPGaVNfh3gidbWg";
const URL_BLOB   = "https://prod-03.francecentral.logic.azure.com:443/workflows/d68ea661e2a34b768a39d2ad471a4205/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=F1A9O71T_yq9R5yw-TKA9vw6s7usxGcRYcNV3KFrf_c";

const DEFAULT_IMG = "https://stcookshareshazin.blob.core.windows.net/media/default-recipe.jpg";

// Global State
let allRecipes = []; 
let currentUser = null;

// --- 2. INITIALIZATION ---
$(document).ready(async function() {
    await checkAuth(); // Check user identity first
    fetchAll();        // Then load data from Azure
});

// --- 3. IDENTITY & UTILITY FUNCTIONS ---

/**
 * Fetches identity from Azure Static Web Apps built-in auth
 */
// --- Identity Functions for Blob Storage ---

function login() {
    const name = prompt("Please enter your name to simulate a login:");
    if (name && name.trim() !== "") {
        localStorage.setItem("cookshare_user", name.trim());
        // Track the login event in Azure
        appInsights.trackEvent({ name: 'UserLogin', properties: { user: name } });
        location.reload();
    }
}

function logout() {
    localStorage.removeItem("cookshare_user");
    location.href = "index.html";
}

/**
 * Updated checkAuth to look at localStorage instead of Azure system routes
 */
function checkAuth() {
    const savedUser = localStorage.getItem("cookshare_user");
    if (savedUser) {
        currentUser = savedUser;
        $("#profile-name").text(currentUser);
        $("#loginLink").hide();
        $("#logoutLink").show();
    } else {
        $("#loginLink").show();
        $("#logoutLink").hide();
    }
}
/**
 * Formats Azure Cosmos _ts to human-readable date
 */
function formatTime(unixTs) {
    if(!unixTs) return "Recently Uploaded";
    return new Date(unixTs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Sanitizes strings for HTML onclick events to prevent JS crashes
 */
function cleanString(str) {
    if (!str) return "";
    return String(str)
        .replace(/'/g, "\\'")   // Escape single quotes
        .replace(/\n/g, "\\n")  // Preserve newlines for display
        .replace(/\r/g, "");
}

// --- 4. DATA OPERATIONS ---

// READ & INITIAL FILTER
async function fetchAll() {
    try {
        const response = await fetch(URL_READ);
        // CRITICAL: We must wait for the JSON and store it in allRecipes
        allRecipes = await response.json(); 
        console.log("Data loaded from Azure:", allRecipes.length); // Debug check

        // Initial render based on the page type
        applyPageFilter(); 
    } catch (e) {
        console.error("Fetch Error:", e);
        $("#gallery").html("<p class='text-danger text-center'>Error connecting to Azure Cosmos DB.</p>");
    }
}

// Handles Home vs Profile view
function applyPageFilter() {
    let dataToShow = [...allRecipes];

    if (window.location.pathname.endsWith('profile.html')) {
        // Show only current user's recipes OR the demo ID recipes
        dataToShow = allRecipes.filter(r => r.userId === currentUser || r.userId === "user-789");
        $("#recipe-count").text(`${dataToShow.length} Recipes`);
    }
    
    renderRecipes(dataToShow);
}

// SEARCH: Real-time filtering
function filterRecipes() {
    const query = $("#recipeSearch").val().toLowerCase().trim();
    
    const filtered = allRecipes.filter(recipe => {
        const title = String(recipe.title || "").toLowerCase();
        const ingredients = String(recipe.ingredients || "").toLowerCase();
        const matchesQuery = title.includes(query) || ingredients.includes(query);
        
        // Ensure profile view only shows user data
        const isProfilePage = window.location.pathname.endsWith('profile.html');
        const isOwner = !isProfilePage || (recipe.userId === currentUser || recipe.userId === "user-789");

        return matchesQuery && isOwner;
    });

    renderRecipes(filtered);
}

// CREATE
async function uploadRecipe() {
    const file = document.getElementById("recipeImage").files[0];
    let imgUrl = DEFAULT_IMG;
    $("#status").text("⏳ Uploading to Azure...");

    try {
        if (file) {
            const reader = new FileReader();
            const b64 = await new Promise(r => { reader.onload=()=>r(reader.result.split(',')[1]); reader.readAsDataURL(file); });
            const res = await fetch(URL_BLOB, { 
                method: "POST", 
                body: JSON.stringify({fileName:file.name, fileContent:b64}), 
                headers: {"Content-Type":"application/json"}
            });
            const json = await res.json(); 
            imgUrl = json.imageUrl;
        }

        const recipe = { 
            id: "recipe-" + Date.now(), 
            userId: currentUser || "user-789", 
            title: $("#recipeTitle").val(), 
            ingredients: $("#ingredients").val(), 
            steps: $("#steps").val(), 
            imageUrl: imgUrl 
        };

        await fetch(URL_CREATE, { method: "POST", body: JSON.stringify(recipe), headers: {"Content-Type":"application/json"}});
        location.reload();
    } catch (e) { $("#status").text("❌ Failed."); }
}

// UPDATE (Upsert with image preservation)
async function submitUpdate() {
    const data = { 
        id: $("#edit-id").val(), 
        userId: $("#edit-userId").val(), 
        imageUrl: $("#edit-imageUrl").val(),
        title: $("#edit-title").val(), 
        ingredients: $("#edit-ingredients").val(), 
        steps: $("#edit-steps").val() 
    };

    await fetch(URL_UPDATE, { 
        method: "POST", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify(data)
    });
    location.reload();
}

// DELETE
async function deleteRecipe(id, userId) {
    if(!confirm("Are you sure? This deletes from Azure Cosmos DB.")) return;
    await fetch(URL_DELETE, { 
        method: "POST", 
        headers: {"Content-Type":"application/json"}, 
        body: JSON.stringify({id: String(id), userId: String(userId)})
    });
    fetchAll();
}

// --- 5. MODALS & UI ---

function viewRecipe(title, ingredients, steps, imageUrl, userId, ts) {
    const cleanIngredients = ingredients.replace(/\\n/g, '\n');
    const cleanSteps = steps.replace(/\\n/g, '\n');
    $("#view-title").text(title);
    $("#view-ingredients").text(ingredients);
    $("#view-steps").text(steps);
    $("#view-user").text(userId);
    $("#view-time").text(formatTime(ts));
    $("#view-image").attr("src", imageUrl || DEFAULT_IMG);
    
    new bootstrap.Modal(document.getElementById('viewModal')).show();
}

function editRecipe(id, userId, title, ingredients, steps, imageUrl) {
    $("#edit-id").val(id); 
    $("#edit-userId").val(userId); 
    $("#edit-imageUrl").val(imageUrl);
    $("#edit-title").val(title); 
    $("#edit-ingredients").val(ingredients); 
    $("#edit-steps").val(steps);
    
    new bootstrap.Modal(document.getElementById('updateModal')).show();
}

// --- 6. RENDER ENGINE (3-Column Grid) ---

function renderRecipes(data) {
    const gallery = $("#gallery");
    gallery.empty();

    if (!data || data.length === 0) {
        gallery.html("<div class='col-12 text-center text-muted'><p>No recipes found matching your criteria.</p></div>");
        return;
    }

    // Sort Newest First
    data.sort((a,b) => b._ts - a._ts).forEach(recipe => {
        const sT = cleanString(recipe.title);
        const sI = cleanString(recipe.ingredients);
        const sS = cleanString(recipe.steps);
        const img = recipe.imageUrl || DEFAULT_IMG;
        const ts = recipe._ts || 0;

        let adminButtons = '';
        if (window.location.pathname.endsWith('portal.html')) {
            adminButtons = `
                <div class="mt-3 text-center border-top pt-2">
                    <button class="btn btn-warning btn-sm me-1" onclick="editRecipe('${recipe.id}','${recipe.userId}','${sT}','${sI}','${sS}','${img}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRecipe('${recipe.id}','${recipe.userId}')">Delete</button>
                </div>`;
        }

        gallery.append(`
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm border-0">
                    <div style="cursor:pointer;" onclick="viewRecipe('${sT}','${sI}','${sS}','${img}','${recipe.userId}',${ts})">
                        <img src="${img}" class="card-img-top" style="height:180px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
                        <div class="card-body pb-0">
                            <h6 class="card-title fw-bold mb-1">${recipe.title || "Untitled"}</h6>
                            <p class="text-muted small mb-1">🕒 ${formatTime(ts)}</p>
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