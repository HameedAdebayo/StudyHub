// script.js - All interactivity

// Tailwind script ready
function initializeTailwind() {
	// Already initialized via CDN
}

// Sample Materials Data
let materials = [
	{
		id: 1,
		title: "Data Structures & Algorithms Complete Notes",
		courseName: "Data Structures",
		courseCode: "CSC201",
		category: "Computer Science",
		description:
			"Arrays, Linked Lists, Trees, Graphs, Sorting algorithms with examples and diagrams.",
		fileName: "csc201_dsa_notes.pdf",
	},
	{
		id: 2,
		title: "Calculus II Past Questions 2018-2024",
		courseName: "Calculus II",
		courseCode: "MTH202",
		category: "Mathematics",
		description: "All past questions from 2018 to 2024 with detailed solutions.",
		fileName: "mth202_past_questions.pdf",
	},
	{
		id: 3,
		title: "Principles of Microeconomics Lecture Slides",
		courseName: "Microeconomics",
		courseCode: "ECO101",
		category: "Economics",
		description: "Demand & Supply, Elasticity, Market Structures. Very detailed slides.",
		fileName: "eco101_slides.pdf",
	},
	{
		id: 4,
		title: "Modern Physics Formula Sheet + Notes",
		courseName: "Modern Physics",
		courseCode: "PHY301",
		category: "Physics",
		description: "Quantum mechanics, Relativity, Nuclear physics formulas explained.",
		fileName: "phy301_modern_physics.pdf",
	},
	{
		id: 5,
		title: "Organic Chemistry Reaction Mechanisms",
		courseName: "Organic Chemistry",
		courseCode: "CHM202",
		category: "Chemistry",
		description: "SN1, SN2, E1, E2 mechanisms with step-by-step illustrations.",
		fileName: "chm202_reactions.pdf",
	},
	{
		id: 6,
		title: "Python for Data Science Cheat Sheet",
		courseName: "Programming for Data Science",
		courseCode: "CSC301",
		category: "Computer Science",
		description: "Pandas, NumPy, Matplotlib quick reference.",
		fileName: "csc301_python.pdf",
	},
	{
		id: 7,
		title: "Linear Algebra Past Questions + Answers",
		courseName: "Linear Algebra",
		courseCode: "MTH101",
		category: "Mathematics",
		description: "Matrices, Vectors, Eigenvalues from 2015-2024.",
		fileName: "mth101_linear_algebra.pdf",
	},
];

// Sample Study Groups
let studyGroups = [
	{
		id: 1,
		title: "CSC Study Group",
		description: "Weekly algorithm & coding challenges. All levels welcome!",
		members: 124,
		joined: false,
	},
	{
		id: 2,
		title: "ECO Study Group",
		description: "Micro & Macro economics discussions + past question solving.",
		members: 87,
		joined: false,
	},
	{
		id: 3,
		title: "Math Problem Solving",
		description: "Calculus, Algebra, Statistics help every Tuesday 7PM.",
		members: 203,
		joined: false,
	},
];

// Current filter state
let currentCategoryFilter = "all";
let currentSearchTerm = "";

// Render Materials
function renderMaterials(filteredMaterials) {
	const container = document.getElementById("materials-grid");
	container.innerHTML = "";

	if (filteredMaterials.length === 0) {
		container.innerHTML = `
            <div class="col-span-3 py-20 text-center">
                <p class="text-2xl text-gray-400">No materials found 😕</p>
            </div>`;
		return;
	}

	filteredMaterials.forEach((material) => {
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
                    
                    <h3 class="font-bold text-xl leading-tight mb-2 line-clamp-2">${material.title}</h3>
                    <p class="text-gray-600 text-sm line-clamp-3 mb-6">${material.description}</p>
                    
                    <div class="flex items-center justify-between">
                        <div onclick="downloadMaterial(${material.id})" 
                             class="flex items-center gap-x-2 text-[#22C55E] hover:text-green-600 cursor-pointer font-medium text-sm">
                            <i class="fas fa-download"></i>
                            <span>DOWNLOAD</span>
                        </div>
                        <button onclick="alert('Opened in new tab (demo)')" 
                                class="text-xs bg-gray-100 hover:bg-gray-200 px-5 py-2 rounded-3xl transition-colors">
                            Preview
                        </button>
                    </div>
                </div>
            </div>`;
		container.innerHTML += cardHTML;
	});
}

// Filter materials
function filterMaterials() {
	currentSearchTerm = document.getElementById("search-input").value.toLowerCase().trim();

	let filtered = materials;

	// Category filter
	if (currentCategoryFilter !== "all") {
		filtered = filtered.filter((m) => m.category === currentCategoryFilter);
	}

	// Search filter
	if (currentSearchTerm) {
		filtered = filtered.filter(
			(m) =>
				m.title.toLowerCase().includes(currentSearchTerm) ||
				m.courseCode.toLowerCase().includes(currentSearchTerm),
		);
	}

	renderMaterials(filtered);
}

// Create category filter buttons
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
			// Update active style
			document.querySelectorAll(".category-btn").forEach((b) => {
				if (b.textContent === (cat === "all" ? "All Materials" : cat)) {
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

// Download handler (demo)
function downloadMaterial(id) {
	const material = materials.find((m) => m.id === id);
	if (material) {
		showToast(`Downloading ${material.fileName}...`);
		// Simulate download
		setTimeout(() => {
			showToast(`${material.title} downloaded! 📥`);
		}, 1200);
	}
}

// Render Study Groups
function renderStudyGroups() {
	const container = document.getElementById("groups-grid");
	container.innerHTML = "";

	studyGroups.forEach((group) => {
		const cardHTML = `
            <div class="group-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                <div class="px-6 pt-6 pb-4">
                    <div class="flex justify-between">
                        <div class="text-[#22C55E] text-sm font-bold">${group.members} members</div>
                        ${
													group.joined
														? `<span class="bg-emerald-100 text-emerald-700 px-4 py-1 rounded-3xl text-xs font-semibold">✓ JOINED</span>`
														: ""
												}
                    </div>
                    <h3 class="text-2xl font-bold mt-3">${group.title}</h3>
                    <p class="text-gray-600 mt-4 text-[15px]">${group.description}</p>
                </div>
                <div class="border-t px-6 py-5">
                    ${
											group.joined
												? `<button onclick="leaveGroup(${group.id})" class="w-full py-4 text-red-600 hover:bg-red-50 font-semibold rounded-2xl transition-colors">Leave Group</button>`
												: `<button onclick="joinGroup(${group.id})" class="w-full py-4 bg-[#111827] hover:bg-black text-white font-semibold rounded-2xl transition-all">Join Group</button>`
										}
                </div>
            </div>`;
		container.innerHTML += cardHTML;
	});
}

// Join group
function joinGroup(id) {
	const group = studyGroups.find((g) => g.id === id);
	if (group) {
		group.joined = true;
		group.members++;
		renderStudyGroups();
		showToast(`Welcome to ${group.title}! 🎉`);
	}
}

function leaveGroup(id) {
	const group = studyGroups.find((g) => g.id === id);
	if (group) {
		group.joined = false;
		group.members--;
		renderStudyGroups();
		showToast(`Left ${group.title}`);
	}
}

// Fake new group creation
function createNewGroup() {
	const name = prompt("What should we call the new study group?");
	if (!name) return;

	const newGroup = {
		id: Date.now(),
		title: name,
		description: "Newly created group – be the first to join!",
		members: 1,
		joined: true,
	};

	studyGroups.unshift(newGroup);
	renderStudyGroups();
	showToast("Group created successfully!");
}

// Upload handler
function handleUpload(e) {
	e.preventDefault();

	const title = document.getElementById("title").value;
	const courseName = document.getElementById("course-name").value;
	const courseCode = document.getElementById("course-code").value;
	const category = document.getElementById("category").value;
	const description = document.getElementById("description").value;
	const fileInput = document.getElementById("file-upload");

	if (!fileInput.files.length) {
		alert("Please select a file");
		return;
	}

	// Create new material
	const newMaterial = {
		id: Date.now(),
		title: title,
		courseName: courseName,
		courseCode: courseCode,
		category: category,
		description: description,
		fileName: fileInput.files[0].name,
	};

	materials.unshift(newMaterial);

	// Success
	showToast("Material uploaded successfully! 🎉");

	// Reset form
	document.getElementById("upload-form").reset();
	document.getElementById("file-name").textContent = "";

	// If user is on materials page, refresh
	if (!document.getElementById("materials").classList.contains("hidden")) {
		filterMaterials();
	}
}

// File name preview
document.addEventListener("change", function (e) {
	if (e.target.id === "file-upload") {
		const fileNameEl = document.getElementById("file-name");
		if (e.target.files.length > 0) {
			fileNameEl.textContent = `Selected: ${e.target.files[0].name}`;
		}
	}
});

// Contact form
function handleContact(e) {
	e.preventDefault();
	showToast("Thank you! Your message has been received.");
	document.getElementById("contact-form").reset();
}

// Navigation
function showSection(sectionId) {
	// Hide all sections
	document.querySelectorAll(".page-section").forEach((section) => {
		section.classList.add("hidden");
	});

	// Show target
	const target = document.getElementById(sectionId);
	if (target) target.classList.remove("hidden");

	// Update active nav link
	document.querySelectorAll(".nav-link").forEach((link) => {
		link.classList.remove("active");
		if (link.getAttribute("onclick").includes(sectionId)) {
			link.classList.add("active");
		}
	});

	// Special case: refresh data when switching to certain pages
	if (sectionId === "materials") {
		filterMaterials();
	}
	if (sectionId === "groups") {
		renderStudyGroups();
	}
}

// Mobile menu
function toggleMobileMenu() {
	const menu = document.getElementById("mobile-menu");
	menu.classList.toggle("hidden");
}

document.getElementById("mobile-menu-btn").addEventListener("click", toggleMobileMenu);

// Toast helper
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

// Keyboard shortcut: press "/" to focus search
document.addEventListener("keydown", function (e) {
	if (
		e.key === "/" &&
		document.getElementById("materials").classList.contains("hidden") === false
	) {
		e.preventDefault();
		document.getElementById("search-input").focus();
	}
});

// Initialize everything
function initializeApp() {
	// Tailwind ready
	initializeTailwind();

	// Render initial materials
	createCategoryFilters();
	renderMaterials(materials);

	// Render groups
	renderStudyGroups();

	// Show home by default
	showSection("home");

	// Keyboard hint
	console.log(
		'%cStudyHub ready! Press "/" on the materials page to search',
		"color:#22C55E; font-size:10px",
	);

	// Demo toast after 2.5s
	setTimeout(() => {
		if (!document.getElementById("home").classList.contains("hidden")) {
			showToast("Welcome back to StudyHub 👋");
		}
	}, 2500);
}

// Boot the app
window.onload = initializeApp;
