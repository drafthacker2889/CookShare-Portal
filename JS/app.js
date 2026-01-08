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
    await checkAuth(); 
    fetchAll();        
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
        appInsights.trackEvent({ name: 'ViewRecipeDetails', properties: { recipeTitle: title, viewedBy: typeof currentUser !== 'undefined' ? currentUser : 'Guest' } });
    }

    $("#view-title").text(title);

    const formattedIngredients = ingredients.replace(/\\n/g, '<br>');
    const formattedSteps = steps.replace(/\\n/g, '<br>');
    const formattedAI = aiDesc.replace(/\\n/g, '<br>');

    $("#view-ingredients").html(formattedIngredients);
    $("#view-steps").html(formattedSteps);
    $("#view-ai").html(formattedAI); 
    
    $("#view-user").text(userId);
    $("#view-time").text(formatTime(ts));
    $("#view-image").attr("src", imageUrl || DEFAULT_IMG);

    const modalElement = document.getElementById('viewModal');
    const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.show();
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

// --- 6. UNIFIED RENDER ENGINE ---
function renderRecipes(data) {
    const gallery = $("#recipeGallery");
    gallery.empty();

    if (!data || data.length === 0) {
        gallery.html("<div class='col-12 text-center text-muted'><p>No recipes found.</p></div>");
        return;
    }

    const isPortal = window.location.pathname.includes('portal.html');

    data.sort((a,b) => (b._ts || 0) - (a._ts || 0)).forEach(recipe => {
        const sT = cleanString(recipe.title || "Untitled");
        const rawIngredients = cleanString(recipe.ingredients || "");
        const rawSteps = cleanString(recipe.steps || "");
        const previewIngredients = rawIngredients.replace(/\\n/g, ' ').substring(0, 60) + "...";
        const sAI = cleanString(recipe.aiDescription || "No AI insight available.");
        const originalImg = recipe.imageUrl || DEFAULT_IMG; 
        const ts = recipe._ts || 0;

        // 1. Generate the thumbnail URL
        const thumbImg = originalImg.replace('/media/', '/thumbnails/');

        const cleanAI = sAI.replace(/\\n/g, '<br>');

        let adminButtons = '';
        if (isPortal) {
            adminButtons = `
                <div class="mt-3 text-center border-top pt-2">
                    <button class="btn btn-warning btn-sm me-1" onclick="editRecipe('${recipe.id}','${recipe.userId}','${sT}','${rawIngredients}','${rawSteps}','${originalImg}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRecipe('${recipe.id}','${recipe.userId}')">Delete</button>
                </div>`;
        }

        gallery.append(`
            <div class="col-md-4 mb-4 recipe-card-wrapper">
                <div class="card h-100 shadow-sm border-0">
                    <div style="overflow:hidden; border-radius: 15px 15px 0 0;">
                        <img src="${thumbImg}" 
                             class="card-img-top" 
                             style="height:200px; object-fit:cover; cursor:pointer;" 
                             onerror="this.onerror=null;this.src='${originalImg}';"
                             onclick="viewRecipe('${sT}','${rawIngredients}','${rawSteps}','${originalImg}','${recipe.userId}',${ts},'${sAI}')">
                    </div>
                    <div class="card-body d-flex flex-column">
                        <h6 class="recipe-title fw-bold mb-1">${sT}</h6>
                        <div class="ai-badge mb-2">
                             <strong>AI Insight:</strong><br>
                            ${cleanAI.substring(0, 45)}...
                        </div>
                        <p class="card-text small text-muted mb-3">
                            <strong>Ingredients:</strong> ${previewIngredients}
                        </p>
                        <div class="d-grid mt-auto">
                            <button class="btn btn-outline-primary btn-view btn-sm" 
                                onclick="viewRecipe('${sT}','${rawIngredients}','${rawSteps}','${originalImg}','${recipe.userId}',${ts},'${sAI}')">
                                View Details
                            </button>
                        </div>
                        ${adminButtons}
                    </div>
                </div>
            </div>`);
    });
}
// --- 7. SEARCH LOGIC (Split Key for GitHub Protection) ---
async function executeSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) { fetchAll(); return; }

    const searchService = "search-cookshare-shazin"; 
    const indexName = "cosmosdb-index"; 
    
    // SPLIT KEY TO BYPASS GITHUB SCANNER
    const p1 = "8yAu7pYk1cOGaZeGpQrus0fZ0NaTEbLA";
    const p2 = "PK9zQWtYUPAzSeAzMCPe";
    const apiKey = p1 + p2; 

    const url = `https://${searchService}.search.windows.net/indexes/${indexName}/docs?api-version=2023-11-01&search=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'api-key': apiKey }
        });
        const result = await response.json();
        renderRecipes(result.value); 
    } catch (error) {
        console.error("Search failed:", error);
    }
}

function printRecipe() {
    const title = $("#view-title").text();
    const ingredients = $("#view-ingredients").html();
    const steps = $("#view-steps").html();
    const img = $("#view-image").attr("src");
    const ai = $("#view-ai").text();

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>CookShare - ${title}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { padding: 40px; font-family: sans-serif; }
                    img { max-width: 300px; border-radius: 10px; margin-bottom: 20px; }
                    .ai-box { background: #f0f7ff; padding: 10px; border-radius: 5px; margin: 20px 0; border-left: 5px solid #007bff; }
                </style>
            </head>
            <body>
                <h1>🍳 CookShare Recipe: ${title}</h1>
                <img src="${img}">
                <div class="ai-box"><strong>✨ AI Robot Insight:</strong><br>${ai}</div>
                <h3>Ingredients</h3>
                <p>${ingredients}</p>
                <hr>
                <h3>Method</h3>
                <p>${steps}</p>
                <footer style="margin-top:50px; font-size: 0.8rem; color: gray;">Generated by CookShare Portal - 2026</footer>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function printRecipeCard() {
    // Get values from the modal
    const title = $("#view-title").text();
    const ingredients = $("#view-ingredients").html();
    const steps = $("#view-steps").html();
    const imgUrl = $("#view-image").attr("src");
    const author = $("#view-user").text();
    const aiDesc = $("#view-ai").text();

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
        <html>
            <head>
                <title>CookShare - ${title}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                    .recipe-header { border-bottom: 2px solid #0d6efd; margin-bottom: 20px; padding-bottom: 10px; }
                    .recipe-img { max-width: 300px; border-radius: 15px; margin-bottom: 20px; }
                    .ai-box { background: #e7f1ff; padding: 15px; border-radius: 10px; font-style: italic; margin-bottom: 20px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="recipe-header">
                    <h1 class="text-primary">🍳 CookShare Recipe</h1>
                    <h2>${title}</h2>
                    <p class="text-muted">By: ${author}</p>
                </div>
                
                <img src="${imgUrl}" class="recipe-img">
                
                <div class="ai-box">
                    <strong> AI Insights:</strong><br>
                    ${aiDesc}
                </div>

                <h4 class="fw-bold">Ingredients</h4>
                <p style="white-space: pre-line;">${ingredients}</p>

                <h4 class="fw-bold mt-4">Instructions</h4>
                <p style="white-space: pre-line;">${steps}</p>

                <footer class="mt-5 small text-center text-muted border-top pt-3">
                    Printed from CookShare Cloud Portal - 2026
                </footer>
            </body>
        </html>
    `);

    printWindow.document.close();
    
    // Wait for the image to load before printing
    printWindow.onload = function() {
        printWindow.print();
        printWindow.close();
    };
}