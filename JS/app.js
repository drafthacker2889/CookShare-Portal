/**
 * CookShare Integrated Cloud Logic - Final Production Version
 * Architecture: Azure Logic Apps + Cosmos DB + Blob Storage + AI Vision + App Insights
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

function login() {
    const name = prompt("Please enter your name to simulate a login:");
    if (name && name.trim() !== "") {
        const username = name.trim();
        localStorage.setItem("cookshare_user", username);
        
        // Advanced Feature: Telemetry Context
        if (window.appInsights) {
            appInsights.setAuthenticatedUserContext(username);
            appInsights.trackEvent({ name: 'UserLogin', properties: { user: username } });
        }
        location.reload();
    }
}

function logout() {
    if (window.appInsights) {
        appInsights.trackEvent({ name: 'UserLogout', properties: { user: currentUser } });
        appInsights.clearAuthenticatedUserContext();
    }
    localStorage.removeItem("cookshare_user");
    location.href = "index.html";
}

function checkAuth() {
    const savedUser = localStorage.getItem("cookshare_user");
    if (savedUser) {
        currentUser = savedUser;
        $("#profile-name").text(currentUser);
        $("#loginLink").hide();
        $("#logoutLink").show();
        if (window.appInsights) appInsights.setAuthenticatedUserContext(currentUser);
    } else {
        $("#loginLink").show();
        $("#logoutLink").hide();
    }
}

function formatTime(unixTs) {
    if(!unixTs) return "Recently Uploaded";
    return new Date(unixTs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function cleanString(str) {
    if (!str) return "";
    return String(str).replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "");
}

// --- 4. DATA OPERATIONS ---

async function fetchAll() {
    try {
        const response = await fetch(URL_READ);
        allRecipes = await response.json(); 
        applyPageFilter(); 
    } catch (e) {
        if (window.appInsights) appInsights.trackException({ exception: e });
        console.error("Fetch Error:", e);
        $("#gallery").html("<p class='text-danger text-center'>Error connecting to Azure Cosmos DB.</p>");
    }
}

function applyPageFilter() {
    let dataToShow = [...allRecipes];
    if (window.location.pathname.endsWith('profile.html')) {
        dataToShow = allRecipes.filter(r => r.userId === currentUser || r.userId === "user-789");
        $("#recipe-count").text(`${dataToShow.length} Recipes`);
    }
    renderRecipes(dataToShow);
}

function filterRecipes() {
    const query = $("#recipeSearch").val().toLowerCase().trim();
    const filtered = allRecipes.filter(recipe => {
        const title = String(recipe.title || "").toLowerCase();
        const ingredients = String(recipe.ingredients || "").toLowerCase();
        const matchesQuery = title.includes(query) || ingredients.includes(query);
        const isProfilePage = window.location.pathname.endsWith('profile.html');
        const isOwner = !isProfilePage || (recipe.userId === currentUser || recipe.userId === "user-789");
        return matchesQuery && isOwner;
    });
    renderRecipes(filtered);
}

async function uploadRecipe() {
    const file = document.getElementById("recipeImage").files[0];
    const title = $("#recipeTitle").val();
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
            title: title, 
            ingredients: $("#ingredients").val(), 
            steps: $("#steps").val(), 
            imageUrl: imgUrl 
        };

        await fetch(URL_CREATE, { method: "POST", body: JSON.stringify(recipe), headers: {"Content-Type":"application/json"}});
        
        // Tracking the Creation event
        if (window.appInsights) {
            appInsights.trackEvent({ name: 'RecipeCreated', properties: { title: title, user: currentUser } });
        }
        
        location.reload();
    } catch (e) { 
        if (window.appInsights) appInsights.trackException({ exception: e });
        $("#status").text("❌ Failed."); 
    }
}

async function submitUpdate() {
    const data = { 
        id: $("#edit-id").val(), 
        userId: $("#edit-userId").val(), 
        imageUrl: $("#edit-imageUrl").val(),
        title: $("#edit-title").val(), 
        ingredients: $("#edit-ingredients").val(), 
        steps: $("#edit-steps").val() 
    };

    try {
        await fetch(URL_UPDATE, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(data)});
        if (window.appInsights) appInsights.trackEvent({ name: 'RecipeUpdated', properties: { id: data.id } });
        location.reload();
    } catch (e) {
        if (window.appInsights) appInsights.trackException({ exception: e });
    }
}

async function deleteRecipe(id, userId) {
    if(!confirm("Are you sure?")) return;
    try {
        await fetch(URL_DELETE, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({id: String(id), userId: String(userId)})});
        if (window.appInsights) appInsights.trackEvent({ name: 'RecipeDeleted', properties: { id: id, user: currentUser } });
        fetchAll();
    } catch (e) {
        if (window.appInsights) appInsights.trackException({ exception: e });
    }
}

// --- 5. MODALS & UI ---

function viewRecipe(title, ingredients, steps, imageUrl, userId, ts, aiDesc) {
    if (window.appInsights) {
        appInsights.trackEvent({ name: 'ViewRecipeDetails', properties: { recipeTitle: title, viewedBy: currentUser || 'Guest' } });
    }

    $("#view-title").text(title);

    // JS Fix: Replace characters and use .html()
    $("#view-ingredients").html(ingredients.replace(/\n/g, '<br>'));
    $("#view-steps").html(steps.replace(/\n/g, '<br>'));
    
    $("#view-user").text(userId);
    $("#view-time").text(formatTime(ts));
    $("#view-image").attr("src", imageUrl || DEFAULT_IMG);
    $("#view-ai").text(aiDesc || "Analyzing image features..."); 

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

// --- 6. RENDER ENGINE (Integrated with AI Vision) ---

function renderRecipes(data) {
    const gallery = $("#gallery");
    gallery.empty();

    if (!data || data.length === 0) {
        gallery.html("<div class='col-12 text-center text-muted'><p>No recipes found.</p></div>");
        return;
    }

    // Determine if we are on the portal page
    const isPortal = window.location.pathname.includes('portal.html');

    data.sort((a,b) => (b._ts || 0) - (a._ts || 0)).forEach(recipe => {
        const sT = cleanString(recipe.title);
        const sI = cleanString(recipe.ingredients);
        const sS = cleanString(recipe.steps);
        const sAI = cleanString(recipe.aiDescription);
        const img = recipe.imageUrl || DEFAULT_IMG;
        const ts = recipe._ts || 0;

        // Clean the preview text for the tile
        const previewText = sI.replace(/\\n/g, ' ').replace(/\n/g, ' ');

        let adminButtons = '';
        if (isPortal) {
            // Re-adding the missing Management buttons
            adminButtons = `
                <div class="mt-3 text-center border-top pt-2">
                    <button class="btn btn-warning btn-sm me-1" onclick="editRecipe('${recipe.id}','${recipe.userId}','${sT}','${sI}','${sS}','${img}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRecipe('${recipe.id}','${recipe.userId}')">Delete</button>
                </div>`;
        }

        gallery.append(`
            <div class="col-md-4 mb-4">
                <div class="card h-100 shadow-sm border-0 recipe-card">
                    <div style="cursor:pointer;" onclick="viewRecipe('${sT}','${sI}','${sS}','${img}','${recipe.userId}',${ts},'${sAI}')">
                        <img src="${img}" class="card-img-top" style="height:180px; object-fit:cover;" onerror="this.src='${DEFAULT_IMG}'">
                        <div class="card-body pb-0">
                            <h6 class="card-title fw-bold mb-1">${recipe.title || "Untitled"}</h6>
                            <p class="text-muted small mb-1">🕒 ${formatTime(ts)}</p>
                            <p class="card-text small text-muted">${previewText.substring(0, 60)}...</p>
                        </div>
                    </div>
                    <div class="card-body pt-0">
                        ${adminButtons}
                    </div>
                </div>
            </div>`);
    });
}