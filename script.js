// StudyHub Flask Backend Integration
// API base URL - uses same hostname as frontend to avoid CORS cookie issues
const API_BASE = 'https://studyhub-2-jjfo.onrender.com/api';

// Global state
let materials = [];
let studyGroups = [];
let currentCategoryFilter = "all";
let currentSearchTerm = "";
let currentUser = null;

// ==================== AUTH FUNCTIONS ====================

function openAuthModal(tab = "login") {
	document.getElementById("auth-modal").classList.remove("hidden");
	switchAuthTab(tab);
}

function closeAuthModal() {
	document.getElementById("auth-modal").classList.add("hidden");
}

function switchAuthTab(tab) {
	const loginTab = document.getElementById("login-tab");
	const signupTab = document.getElementById("signup-tab");
	const loginForm = document.getElementById("login-form");
	const signupForm = document.getElementById("signup-form");

	if (tab === "login") {
		loginTab.classList.add("text-[#4F46E5]", "border-b-2", "border-[#4F46E5]");
		loginTab.classList.remove("text-gray-400");
		signupTab.classList.remove("text-[#4F46E5]", "border-b-2", "border-[#4F46E5]");
		signupTab.classList.add("text-gray-400");
		loginForm.classList.remove("hidden");
		signupForm.classList.add("hidden");
	} else {
		signupTab.classList.add("text-[#4F46E5]", "border-b-2", "border-[#4F46E5]");
		signupTab.classList.remove("text-gray-400");
		loginTab.classList.remove("text-[#4F46E5]", "border-b-2", "border-[#4F46E5]");
		loginTab.classList.add("text-gray-400");
		signupForm.classList.remove("hidden");
		loginForm.classList.add("hidden");
	}
}

async function handleLogin(e) {
	e.preventDefault();
	const identifier = document.getElementById("login-identifier").value;
	const password = document.getElementById("login-password").value;

	try {
		const res = await fetch(`${API_BASE}/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ identifier, password }),
		});

		const data = await res.json();

		if (res.ok) {
			currentUser = data.user;
			updateAuthUI();
			closeAuthModal();
			showToast(`Welcome back, ${data.user.first_name}! 👋`);
			document.getElementById("login-form").reset();
		} else {
			showToast(data.error || "Login failed");
		}
	} catch (err) {
		showToast("Server error. Is Flask running?");
		console.error(err);
	}
}

async function handleSignup(e) {
	e.preventDefault();
	const data = {
		first_name: document.getElementById("signup-firstname").value,
		last_name: document.getElementById("signup-lastname").value,
		user_name: document.getElementById("signup-username").value,
		email: document.getElementById("signup-email").value,
		phone: document.getElementById("signup-phone").value,
		password: document.getElementById("signup-password").value,
	};

	try {
		const res = await fetch(`${API_BASE}/signup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		const result = await res.json();

		if (res.ok) {
			showToast("Account created! Please login.");
			switchAuthTab("login");
			document.getElementById("signup-form").reset();
		} else {
			showToast(result.error || "Signup failed");
		}
	} catch (err) {
		showToast("Server error. Is Flask running?");
		console.error(err);
	}
}

async function logout() {
	try {
		await fetch(`${API_BASE}/logout`, {
			method: "POST",
			credentials: "include",
		});
	} catch (e) {}
	currentUser = null;
	updateAuthUI();
	showToast("Logged out successfully");
}

async function checkAuth() {
	try {
		const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
		if (res.ok) {
			const data = await res.json();
			currentUser = data.user;
			console.log("Auth check: logged in as", currentUser.user_name);
		} else {
			console.log("Auth check: not logged in (status", res.status, ")");
			currentUser = null;
		}
	} catch (e) {
		console.error("Auth check failed:", e);
		currentUser = null;
	}
	updateAuthUI();
}

function updateAuthUI() {
	const authButtons = document.getElementById("auth-buttons");
	const userMenu = document.getElementById("user-menu");
	const userGreeting = document.getElementById("user-greeting");
	const uploadForm = document.getElementById("upload-form");
	const uploadPrompt = document.getElementById("upload-login-prompt");

	if (currentUser) {
		authButtons.classList.add("hidden");
		userMenu.classList.remove("hidden");
		userMenu.classList.add("flex");
		userGreeting.textContent = `@${currentUser.user_name}`;

		if (uploadForm) uploadForm.classList.remove("hidden");
		if (uploadPrompt) uploadPrompt.classList.add("hidden");
	} else {
		authButtons.classList.remove("hidden");
		userMenu.classList.add("hidden");
		userMenu.classList.remove("flex");

		if (uploadForm) uploadForm.classList.add("hidden");
		if (uploadPrompt) uploadPrompt.classList.remove("hidden");
	}
}

// ==================== MATERIALS FUNCTIONS ====================

async function loadMaterials() {
	try {
		const res = await fetch(`${API_BASE}/materials`);
		const data = await res.json();
		materials = data.materials || [];
		updateHomeStats();
		if (!document.getElementById("materials").classList.contains("hidden")) {
			filterMaterials();
		}
	} catch (err) {
		console.error("Error loading materials:", err);
		showToast("Failed to load materials");
	}
}

function updateHomeStats() {
	const matStat = document.getElementById("stat-materials");
	const grpStat = document.getElementById("stat-groups");
	if (matStat) matStat.textContent = materials.length.toLocaleString() + "+";
	if (grpStat) grpStat.textContent = studyGroups.length;
}

function renderMaterials(filteredMaterials) {
	const container = document.getElementById("materials-grid");
	container.innerHTML = "";

	if (filteredMaterials.length === 0) {
		container.innerHTML = `
            <div class="col-span-3 py-20 text-center">
                <div class="text-6xl mb-4">📭</div>
                <p class="text-2xl text-gray-400">No materials found</p>
                <p class="text-gray-500 mt-2">Be the first to upload!</p>
            </div>`;
		return;
	}

	filteredMaterials.forEach((material) => {
		const uploadDate = material.uploadDate
			? new Date(material.uploadDate).toLocaleDateString()
			: "Recently";

		const fileIcon = getFileIcon(material.fileType, material.fileName);

		const cardHTML = `
            <div class="material-card bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
                <div class="h-2 bg-gradient-to-r from-[#4F46E5] to-[#22C55E]"></div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <span class="inline-block px-4 py-1 bg-indigo-100 text-[#4F46E5] text-xs font-semibold rounded-3xl">${material.courseCode}</span>
                        </div>
                        <span class="text-xs font-medium text-gray-400">${material.category}</span>
                    </div>

                    <div class="flex items-center gap-x-3 mb-3">
                        <div class="text-3xl">${fileIcon}</div>
                        <h3 class="font-bold text-xl leading-tight line-clamp-2">${material.title}</h3>
                    </div>
                    <p class="text-gray-600 text-sm line-clamp-3 mb-4">${material.description}</p>

                    <div class="flex items-center gap-x-2 text-xs text-gray-500 mb-6">
                        <span>📅 ${uploadDate}</span>
                        <span>•</span>
                        <span>👤 ${material.uploaderName || "Anonymous"}</span>
                        <span>•</span>
                        <span>⬇️ ${material.downloads || 0}</span>
                    </div>

                    <div class="flex items-center justify-between">
                        <button onclick="downloadMaterial('${material.id}')" 
                             class="flex items-center gap-x-2 text-[#22C55E] hover:text-green-600 cursor-pointer font-medium text-sm bg-green-50 hover:bg-green-100 px-4 py-2 rounded-2xl transition-colors">
                            <i class="fas fa-download"></i>
                            <span>DOWNLOAD</span>
                        </button>
                        ${
													currentUser && material.uploaderId === currentUser.user_id
														? `<button onclick="deleteMaterial('${material.id}')" 
                                class="text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-2xl hover:bg-red-50 transition-colors">
                                <i class="fas fa-trash"></i>
                            </button>`
														: `<button onclick="previewMaterial('${material.id}')" 
                                class="text-xs bg-gray-100 hover:bg-gray-200 px-5 py-2 rounded-3xl transition-colors">
                                Preview
                            </button>`
												}
                    </div>
                </div>
            </div>`;
		container.innerHTML += cardHTML;
	});
}

function getFileIcon(fileType, fileName) {
	if (!fileType && fileName) {
		const ext = fileName.split(".").pop().toLowerCase();
		if (["png", "jpg", "jpeg", "gif"].includes(ext)) return "🖼️";
		if (["pdf"].includes(ext)) return "📄";
		if (["doc", "docx"].includes(ext)) return "📝";
		if (["zip"].includes(ext)) return "📦";
		return "📎";
	}
	if (fileType && fileType.startsWith("image/")) return "🖼️";
	if (fileType === "application/pdf") return "📄";
	return "📎";
}

function filterMaterials() {
	currentSearchTerm = document.getElementById("search-input").value.toLowerCase().trim();

	let filtered = materials;

	if (currentCategoryFilter !== "all") {
		filtered = filtered.filter((m) => m.category === currentCategoryFilter);
	}

	if (currentSearchTerm) {
		filtered = filtered.filter(
			(m) =>
				m.title.toLowerCase().includes(currentSearchTerm) ||
				m.courseCode.toLowerCase().includes(currentSearchTerm),
		);
	}

	renderMaterials(filtered);
}

function createCategoryFilters() {
	const categories = [
		"all",
		"Computer Science",
		"Mathematics",
		"Economics",
		"Physics",
		"Chemistry",
	];
	const container = document.getElementById("category-filters");
	container.innerHTML = "";

	categories.forEach((cat) => {
		const btn = document.createElement("button");
		btn.className = `category-btn px-7 py-3 text-sm font-medium rounded-3xl transition-all ${cat === "all" ? "bg-[#4F46E5] text-white shadow-md" : "bg-white border hover:bg-gray-50"}`;
		btn.textContent = cat === "all" ? "All Materials" : cat;
		btn.onclick = () => {
			currentCategoryFilter = cat;
			document.querySelectorAll(".category-btn").forEach((b) => {
				const isActive = b.textContent === (cat === "all" ? "All Materials" : cat);
				if (isActive) {
					b.classList.add("bg-[#4F46E5]", "text-white", "shadow-md");
					b.classList.remove("bg-white", "border", "hover:bg-gray-50");
				} else {
					b.classList.remove("bg-[#4F46E5]", "text-white", "shadow-md");
					b.classList.add("bg-white", "border", "hover:bg-gray-50");
				}
			});
			filterMaterials();
		};
		container.appendChild(btn);
	});
}

async function downloadMaterial(id) {
	const material = materials.find((m) => m.id === id);
	if (!material || !material.downloadURL) {
		showToast("Download link not available");
		return;
	}

	try {
		// Increment download count on backend
		fetch(`${API_BASE}/materials/${id}/download`, {
			method: "POST",
			credentials: "include",
		}).catch(() => {});

		// Update local count
		material.downloads = (material.downloads || 0) + 1;
		filterMaterials();

		// Cloudinary URL is already a full URL - just open it
		console.log("Downloading from:", material.downloadURL);
		window.open(material.downloadURL, "_blank");

		showToast(`Downloading ${material.fileName}...`);
	} catch (error) {
		console.error("Download error:", error);
		showToast("Download failed. Please try again.");
	}
}

function previewMaterial(id) {
	const material = materials.find((m) => m.id === id);
	if (material && material.downloadURL) {
		window.open(material.downloadURL, "_blank");
	}
}

async function deleteMaterial(id) {
	if (!confirm("Are you sure you want to delete this material?")) return;

	showToast("Deleting...");

	try {
		const res = await fetch(`${API_BASE}/materials/${id}`, {
			method: "DELETE",
			credentials: "include",
		});

		if (res.ok) {
			materials = materials.filter((m) => m.id !== id);
			filterMaterials();
			updateHomeStats();
			showToast("Material deleted successfully");
		} else {
			const data = await res.json();
			showToast(data.error || "Delete failed");
		}
	} catch (error) {
		console.error("Delete error:", error);
		showToast("Error deleting material");
	}
}

// ==================== STUDY GROUPS ====================

async function loadGroups() {
	try {
		const res = await fetch(`${API_BASE}/groups`, { credentials: "include" });
		const data = await res.json();
		studyGroups = data.groups || [];
		updateHomeStats();
		if (!document.getElementById("groups").classList.contains("hidden")) {
			renderStudyGroups();
		}
	} catch (err) {
		console.error("Error loading groups:", err);
	}
}

function renderStudyGroups() {
	const container = document.getElementById("groups-grid");
	container.innerHTML = "";

	if (studyGroups.length === 0) {
		container.innerHTML = `
            <div class="col-span-3 py-20 text-center">
                <div class="text-6xl mb-4">👥</div>
                <p class="text-2xl text-gray-400">No study groups yet</p>
                <p class="text-gray-500 mt-2">Be the first to create one!</p>
            </div>`;
		return;
	}

	studyGroups.forEach((group) => {
		const cardHTML = `
            <div class="group-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <div class="px-6 pt-6 pb-4">
                    <div class="flex justify-between">
                        <div class="text-[#22C55E] text-sm font-bold">${group.members} members</div>
                        ${group.joined ? `<span class="bg-emerald-100 text-emerald-700 px-4 py-1 rounded-3xl text-xs font-semibold">✓ JOINED</span>` : ""}
                    </div>
                    <h3 class="text-2xl font-bold mt-3">${group.title}</h3>
                    <p class="text-gray-600 mt-4 text-[15px]">${group.description}</p>
                </div>
                <div class="border-t px-6 py-5">
                    ${
											group.joined
												? `<button onclick="leaveGroup('${group.id}')" class="w-full py-4 text-red-600 hover:bg-red-50 font-semibold rounded-2xl transition-colors">Leave Group</button>`
												: `<button onclick="joinGroup('${group.id}')" class="w-full py-4 bg-[#111827] hover:bg-black text-white font-semibold rounded-2xl transition-all">Join Group</button>`
										}
                </div>
            </div>`;
		container.innerHTML += cardHTML;
	});
}

async function joinGroup(id) {
	if (!currentUser) {
		openAuthModal("login");
		return;
	}
	try {
		const res = await fetch(`${API_BASE}/groups/${id}/join`, {
			method: "POST",
			credentials: "include",
		});
		if (res.ok) {
			await loadGroups();
			const group = studyGroups.find((g) => g.id === id);
			showToast(`Welcome to ${group?.title || "the group"}! 🎉`);
		} else {
			const data = await res.json();
			showToast(data.error || "Failed to join");
		}
	} catch (err) {
		showToast("Server error");
	}
}

async function leaveGroup(id) {
	try {
		const res = await fetch(`${API_BASE}/groups/${id}/leave`, {
			method: "POST",
			credentials: "include",
		});
		if (res.ok) {
			await loadGroups();
			const group = studyGroups.find((g) => g.id === id);
			showToast(`Left ${group?.title || "the group"}`);
		}
	} catch (err) {
		showToast("Server error");
	}
}

async function createNewGroup() {
	if (!currentUser) {
		openAuthModal("login");
		return;
	}
	const name = prompt("What should we call the new study group?");
	if (!name) return;

	try {
		const res = await fetch(`${API_BASE}/groups`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ name }),
		});

		if (res.ok) {
			await loadGroups();
			showToast("Group created successfully!");
		} else {
			const data = await res.json();
			showToast(data.error || "Failed to create group");
		}
	} catch (err) {
		showToast("Server error");
	}
}

// ==================== UPLOAD ====================

async function handleUpload(e) {
	e.preventDefault();

	// Re-check auth before uploading (in case session expired)
	if (!currentUser) {
		await checkAuth();
		if (!currentUser) {
			openAuthModal("login");
			return;
		}
	}

	const title = document.getElementById("title").value;
	const courseName = document.getElementById("course-name").value;
	const courseCode = document.getElementById("course-code").value.toUpperCase();
	const category = document.getElementById("category").value;
	const description = document.getElementById("description").value;
	const fileInput = document.getElementById("file-upload");

	if (!fileInput.files.length) {
		alert("Please select a file");
		return;
	}

	const file = fileInput.files[0];
	const submitBtn = e.target.querySelector('button[type="submit"]');
	const originalBtnText = submitBtn.innerHTML;

	submitBtn.disabled = true;
	submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;

	let progressBar = document.getElementById("upload-progress");
	if (!progressBar) {
		progressBar = document.createElement("div");
		progressBar.id = "upload-progress";
		progressBar.className = "w-full bg-gray-200 rounded-full h-2.5 mb-4";
		progressBar.innerHTML =
			'<div class="bg-[#4F46E5] h-2.5 rounded-full transition-all duration-300" style="width: 0%"></div>';
		document.getElementById("upload-form").insertBefore(progressBar, submitBtn);
	}
	const progressFill = progressBar.querySelector("div");
	progressFill.style.width = "30%";

	const formData = new FormData();
	formData.append("file", file);
	formData.append("title", title);
	formData.append("courseName", courseName);
	formData.append("courseCode", courseCode);
	formData.append("category", category);
	formData.append("description", description);

	try {
		progressFill.style.width = "60%";

		const res = await fetch(`${API_BASE}/upload`, {
			method: "POST",
			credentials: "include",
			body: formData,
		});

		progressFill.style.width = "100%";

		const data = await res.json();

		if (res.ok) {
			showToast("Material uploaded successfully! 🎉");
			document.getElementById("upload-form").reset();
			document.getElementById("file-name").textContent = "";
			progressBar.remove();

			await loadMaterials();
			setTimeout(() => showSection("materials"), 1000);
		} else {
			const errorData = await res.json().catch(() => ({ error: "Upload failed" }));
			showToast(errorData.error || "Upload failed");
			progressBar.remove();
		}
	} catch (error) {
		console.error("Upload error:", error);
		showToast("Upload failed: Server error");
		if (progressBar) progressBar.remove();
	} finally {
		submitBtn.disabled = false;
		submitBtn.innerHTML = originalBtnText;
	}
}

// File name preview
document.addEventListener("change", function (e) {
	if (e.target.id === "file-upload") {
		const fileNameEl = document.getElementById("file-name");
		if (e.target.files.length > 0) {
			const file = e.target.files[0];
			const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
			fileNameEl.textContent = `Selected: ${file.name} (${sizeMB} MB)`;
		}
	}
});

// ==================== CONTACT ====================

async function handleContact(e) {
	e.preventDefault();

	const name = document.getElementById("contact-name").value;
	const email = document.getElementById("contact-email").value;
	const message = document.getElementById("contact-message").value;

	try {
		const res = await fetch(`${API_BASE}/contact`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, email, message }),
		});

		if (res.ok) {
			showToast("Thank you! Your message has been received.");
			document.getElementById("contact-form").reset();
		} else {
			const data = await res.json();
			showToast(data.error || "Failed to send message");
		}
	} catch (err) {
		showToast("Server error. Is Flask running?");
	}
}

// ==================== NAVIGATION ====================

function showSection(sectionId) {
	document.querySelectorAll(".page-section").forEach((section) => {
		section.classList.add("hidden");
	});

	const target = document.getElementById(sectionId);
	if (target) target.classList.remove("hidden");

	document.querySelectorAll(".nav-link").forEach((link) => {
		link.classList.remove("active");
		if (link.getAttribute("onclick").includes(sectionId)) {
			link.classList.add("active");
		}
	});

	if (sectionId === "materials") {
		loadMaterials();
	}
	if (sectionId === "groups") {
		loadGroups();
	}

	window.scrollTo(0, 0);
}

function toggleMobileMenu() {
	const menu = document.getElementById("mobile-menu");
	menu.classList.toggle("hidden");
}

// ==================== TOAST ====================

function showToast(message) {
	const toast = document.getElementById("toast");
	const text = document.getElementById("toast-text");
	text.textContent = message;
	toast.classList.remove("hidden");
	toast.style.transform = "translateY(0)";

	setTimeout(() => {
		toast.style.transform = "translateY(80px)";
		setTimeout(() => {
			toast.classList.add("hidden");
		}, 400);
	}, 2800);
}

// ==================== KEYBOARD SHORTCUTS ====================

document.addEventListener("keydown", function (e) {
	if (
		e.key === "/" &&
		document.getElementById("materials").classList.contains("hidden") === false
	) {
		e.preventDefault();
		document.getElementById("search-input").focus();
	}
	if (e.key === "Escape") {
		closeAuthModal();
	}
});

// ==================== INIT ====================

async function initializeApp() {
	console.log("Initializing StudyHub...");

	createCategoryFilters();
	await checkAuth();
	await loadMaterials();
	await loadGroups();

	showSection("home");

	document.getElementById("mobile-menu-btn").addEventListener("click", toggleMobileMenu);

	console.log("%cStudyHub with Flask ready! 🚀", "color:#22C55E; font-size:12px; font-weight:bold");

	setTimeout(() => {
		if (!document.getElementById("home").classList.contains("hidden")) {
			showToast(
				currentUser ? `Welcome back, ${currentUser.first_name}! 👋` : "Welcome to StudyHub 👋",
			);
		}
	}, 2500);
}

window.onload = initializeApp;
