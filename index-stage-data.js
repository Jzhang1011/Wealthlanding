// Data for Life Stages Explorer Tabs with independent guide URLs
        const stageData = {
            early: {
                title: "🌱 Starting Out (Ages 18–25)",
                subtitle: "Building the Foundation & Eliminating High-Interest Debt",
                color: "emerald",
                bgGradient: "from-emerald-950 via-slate-900 to-emerald-900",
                badgeIcon: "fa-seedling",
                illustrationSvg: `<svg width="180" height="140" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-90">
                    <circle cx="100" cy="110" r="45" fill="#22c55e" fill-opacity="0.2"/>
                    <path d="M100 130V70" stroke="#4ade80" stroke-width="6" stroke-linecap="round"/>
                    <path d="M100 90C120 90 135 75 135 55C115 55 100 70 100 90Z" fill="#22c55e"/>
                    <path d="M100 105C80 105 65 90 65 70C85 70 100 85 100 105Z" fill="#16a34a"/>
                    <circle cx="100" cy="45" r="8" fill="#facc15"/>
                </svg>`,
                priorities: [
                    "Build a $1,000 Starter Emergency Reserve",
                    "Understand Credit Score Factors (Target 720+)",
                    "Capture 100% of Employer 401(k) Match",
                    "Manage & Refinance High-Interest Debt"
                ],
                recommendedGuide: "The 20s Money Playbook: 5 Steps to Financial Independence",
                calcName: "Student Debt vs. Investing Tool",
                guideUrl: "life_stage/18_25/playbook_hub.html"
            },
            building: {
                title: "🚀 Building & Growing (Ages 25–40)",
                subtitle: "Wealth Accumulation, Homeownership & Career Acceleration",
                color: "blue",
                bgGradient: "from-blue-950 via-slate-900 to-indigo-900",
                badgeIcon: "fa-rocket",
                illustrationSvg: `<svg width="180" height="140" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-90">
                    <path d="M40 120L80 90L120 105L160 40" stroke="#60a5fa" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="160" cy="40" r="8" fill="#3b82f6"/>
                    <path d="M140 40H160V60" stroke="#60a5fa" stroke-width="6" stroke-linecap="round"/>
                    <rect x="50" y="70" width="30" height="40" rx="4" fill="#1e3a8a" fill-opacity="0.6"/>
                    <rect x="95" y="50" width="30" height="60" rx="4" fill="#1d4ed8" fill-opacity="0.6"/>
                </svg>`,
                priorities: [
                    "3-6 Months Emergency Fund in High-Yield Savings",
                    "First-Time Homebuyer Down Payment & Mortgage Plan",
                    "Max Out Roth IRA ($7,000/yr limit)",
                    "Joint Finances & Shared Budgeting Strategy"
                ],
                recommendedGuide: "How Much House Can You Really Afford?",
                calcName: "Home Affordability & Down Payment Tool",
                guideUrl: "curriculum/home-affordability-guide.html"
            },
            peak: {
                title: "🛡️ Family & Peak Wealth (Ages 40–55)",
                subtitle: "Tax Minimization, Asset Protection & Family Security",
                color: "purple",
                bgGradient: "from-purple-950 via-slate-900 to-purple-900",
                badgeIcon: "fa-shield-halved",
                illustrationSvg: `<svg width="180" height="140" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-90">
                    <path d="M100 30L150 50V90C150 120 100 140 100 140C100 140 50 120 50 90V50L100 30Z" fill="#a855f7" fill-opacity="0.3" stroke="#c084fc" stroke-width="5"/>
                    <path d="M85 85L98 98L122 70" stroke="#e9d5ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`,
                priorities: [
                    "529 College Savings Plan Strategy for Children",
                    "Term Life Insurance & Umbrella Liability Protection",
                    "Advanced Tax-Loss Harvesting & Backdoor Roth",
                    "Max Out Annual Employer 401(k) Limits"
                ],
                recommendedGuide: "Tax-Efficient Portfolio Blueprint",
                calcName: "College Savings & 529 Growth Calculator",
                guideUrl: "curriculum/tax-efficient-portfolio.html"
            },
            retire: {
                title: "🏖️ Pre-Retirement & Freedom (55+ or Whenever you think it is time)",
                subtitle: "Capital Preservation, Healthcare & Withdrawal Sequencing",
                color: "amber",
                bgGradient: "from-amber-950 via-slate-900 to-amber-900",
                badgeIcon: "fa-umbrella-beach",
                illustrationSvg: `<svg width="180" height="140" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" class="opacity-90">
                    <circle cx="130" cy="50" r="22" fill="#fbbf24"/>
                    <path d="M30 130C60 130 80 115 110 115C140 115 160 130 190 130" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
                    <path d="M80 120L105 60C105 60 120 70 135 60" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>
                </svg>`,
                priorities: [
                    "Social Security Claiming Strategy (62 vs 67 vs 70)",
                    "Medicare Supplement & Long-Term Healthcare Plan",
                    "Portfolio Shift to Sustainable Income & Dividends",
                    "Wills, Trusts & Legacy Asset Distribution"
                ],
                recommendedGuide: "Optimize your financial decisions for better retirement",
                calcName: "Retirement optimization engine",
                guideUrl: "Retirement-simulator/Retirement_Gateway.html"
            }
        };

        // Render Active Tab Content with Stage Illustration Graphics
        function selectStageTab(stageKey, goalHighlight = null) {
            const data = stageData[stageKey] || stageData.early;
            
            // Update Tab UI States
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const activeBtn = document.getElementById(`tab-${stageKey}`);
            if (activeBtn) activeBtn.classList.add('active');

            const activeGoal = goalHighlight || userSelectedGoal;
            const goalBadgeHtml = activeGoal ? `
                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-3 border border-emerald-200">
                    <i class="fa-solid fa-bullseye text-brand-600"></i>
                    <span>Customized Goal: ${activeGoal}</span>
                </div>
            ` : '';

            // Render HTML with Visual Illustration Graphic Card
            const box = document.getElementById('stage-content-box');
            box.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div class="lg:col-span-7">
                        ${goalBadgeHtml}
                        <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600 mb-2">
                            <i class="fa-solid ${data.badgeIcon}"></i>
                            <span>Active Stage Focus</span>
                        </div>
                        <h3 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">${data.title}</h3>
                        <p class="text-sm font-medium text-slate-600 mb-6">${data.subtitle}</p>

                        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Top 4 Action Priorities:</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                            ${data.priorities.map(p => `
                                <div class="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                                    <i class="fa-solid fa-circle-check text-brand-600 text-sm mt-0.5"></i>
                                    <span class="text-xs font-semibold text-slate-800">${p}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Visual Stage Graphic Card -->
                    <div class="lg:col-span-5 bg-gradient-to-br ${data.bgGradient} text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between min-h-[280px]">
                        <div class="absolute right-0 top-0 pointer-events-none">
                            ${data.illustrationSvg}
                        </div>
                        
                        <div class="relative z-10">
                            <span class="text-[10px] font-bold tracking-wider text-brand-400 uppercase bg-brand-950/80 px-2.5 py-1 rounded-full border border-brand-800/60 inline-block mb-3">Recommended Curriculum</span>
                            <h4 class="font-extrabold text-white text-lg mb-2 leading-snug">${data.recommendedGuide}</h4>
                            <p class="text-xs text-slate-300 leading-relaxed">Interactive module including downloadable action sheets & step-by-step video breakdown.</p>
                        </div>
                        
                        <div class="relative z-10 pt-4 border-t border-slate-700/80 flex items-center justify-between mt-6">
                            <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><i class="fa-solid fa-calculator text-brand-400"></i> ${data.calcName}</span>
                            <a href="${data.guideUrl}" class="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition shadow-md flex items-center gap-1.5">
                                <span>Start Guide</span>
                                <i class="fa-solid fa-arrow-right text-[10px]"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        // Pathfinder Modal Controls & Direct Path Router
        let userSelectedAge = '18-25';
        let userSelectedGoal = '';

        function openPathfinderModal() {
            document.getElementById('pathfinderModal').classList.remove('hidden');
            document.getElementById('quizStep1').classList.remove('hidden');
            document.getElementById('quizStep2').classList.add('hidden');
            document.getElementById('quizResult').classList.add('hidden');
        }

        function closePathfinderModal() {
            document.getElementById('pathfinderModal').classList.add('hidden');
        }

        function setQuizAge(age) {
            userSelectedAge = age;
            document.getElementById('quizStep1').classList.add('hidden');
            document.getElementById('quizStep2').classList.remove('hidden');
        }

        function finishQuiz(goal) {
            userSelectedGoal = goal;
            document.getElementById('quizStep2').classList.add('hidden');
            document.getElementById('quizResult').classList.remove('hidden');
            document.getElementById('resultSummaryText').innerText = `Configured for age group (${userSelectedAge}) focusing on ${goal}.`;
        }

        // Router function called when user finishes modal quiz
        function navigateToPersonalizedPath() {
            closePathfinderModal();

            // Map Age to Stage Key
            let targetStage = 'early';
            if (userSelectedAge === '25-40') targetStage = 'building';
            else if (userSelectedAge === '40-55') targetStage = 'peak';
            else if (userSelectedAge === '55+') targetStage = 'retire';

            // Select active tab with goal badge
            selectStageTab(targetStage, userSelectedGoal);

            // Scroll smoothly down to the Life Stage Explorer section
            setTimeout(() => {
                const explorerSection = document.getElementById('life-stages-explorer');
                if (explorerSection) {
                    explorerSection.scrollIntoView({ behavior: 'smooth' });
                }
            }, 100);
        }

     

        // Initial Load
        window.onload = function() {
            selectStageTab('early');
        };
