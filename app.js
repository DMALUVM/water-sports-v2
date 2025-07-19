document.addEventListener('DOMContentLoaded', () => {
    const DATA_KEY = 'waterSportsTrackerData';
    const SETTINGS_KEY = 'waterSportsTrackerSettings';
    let data = loadData(DATA_KEY) || {};
    let settings = loadData(SETTINGS_KEY) || {};
    let currentViewDate = new Date();
    let selectedDate = null;
    let editingSessionId = null;
    let yearlyGoal = settings.yearlyGoal || 0;
    let badges = settings.badges || [];
    let chart = null;

    function loadData(key) {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : null;
    }

    function saveData() {
        localStorage.setItem(DATA_KEY, JSON.stringify(data));
        settings.badges = badges;
        settings.yearlyGoal = yearlyGoal;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        updateSummary();
        renderCalendar();
        if (selectedDate) renderDay(selectedDate);
    }

    // Onboarding
    if (!settings.onboarded) {
        const onboardingModal = document.getElementById('onboarding-modal');
        onboardingModal.style.display = 'block';
        const onboardingForm = document.getElementById('onboarding-form');
        onboardingForm.addEventListener('submit', (e) => {
            e.preventDefault();
            settings.preferredSport = document.getElementById('preferred-sport').value;
            settings.defaultUnits = document.getElementById('default-units').value;
            settings.onboarded = true;
            saveData();
            onboardingModal.style.display = 'none';
        });
        document.querySelector('.close-onboarding').onclick = () => {
            settings.onboarded = true;
            saveData();
            onboardingModal.style.display = 'none';
        };
    }

    // Dark Mode Toggle
    document.getElementById('toggle-dark-mode').addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        settings.darkMode = document.body.classList.contains('dark-mode');
        saveData();
    });
    if (settings.darkMode) document.body.classList.add('dark-mode');

    // Moon Phase Calculation
    function getMoonPhase(year, month, day) {
        let c = 0, e = 0, jd = 0, b = 0;
        if (month < 3) {
            year--;
            month += 12;
        }
        ++month;
        c = 365.25 * year;
        e = 30.6 * month;
        jd = c + e + day - 694039.09; // jd is total days elapsed
        jd /= 29.5305882; // divide by the moon cycle
        b = parseInt(jd); // int(jd) -> b, take integer part of jd
        jd -= b; // subtract integer part to leave fractional part of original jd
        b = Math.round(jd * 8); // scale fraction from 0-8 and round
        if (b >= 8) {
            b = 0; // 0 and 8 are the same so turn 8 into 0
        }
        return b;
    }

    const moonEmojis = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const moonPhases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

    // Calendar functions
    function renderCalendar() {
        const month = currentViewDate.getMonth();
        const year = currentViewDate.getFullYear();
        document.getElementById('current-month').textContent = `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentViewDate)} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const tbody = document.getElementById('calendar-body');
        tbody.innerHTML = '';

        let row = document.createElement('tr');
        for (let i = 0; i < firstDay; i++) {
            row.innerHTML += '<td></td>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            if (row.children.length === 7) {
                tbody.appendChild(row);
                row = document.createElement('tr');
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasSessions = data[dateStr] && data[dateStr].length > 0;
            const td = document.createElement('td');
            const phaseIndex = getMoonPhase(year, month + 1, day);
            td.innerHTML = `${day}<span class="moon-emoji">${moonEmojis[phaseIndex]}</span>`;
            if (hasSessions) td.classList.add('has-sessions');
            td.addEventListener('click', () => selectDay(dateStr));
            row.appendChild(td);
        }

        while (row.children.length < 7) {
            row.innerHTML += '<td></td>';
        }
        tbody.appendChild(row);
    }

    document.getElementById('prev-month').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        renderCalendar();
    });

    function selectDay(dateStr) {
        selectedDate = dateStr;
        renderDay(dateStr);
        document.getElementById('day-view').style.display = 'block';
    }

    function renderDay(dateStr) {
        const [year, month, day] = dateStr.split('-').map(Number);
        const phaseIndex = getMoonPhase(year, month, day);
        document.getElementById('day-title').innerHTML = `Sessions for ${dateStr} <small>(Moon Phase: ${moonPhases[phaseIndex]} ${moonEmojis[phaseIndex]})</small>`;
        let sessionsList = data[dateStr] || [];
        sessionsList.sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';
        let dayTotal = 0;
        let dayAvgSpeed = 0;
        let sessionCount = sessionsList.length;
        sessionsList.forEach((session, index) => {
            dayTotal += session.distance;
            dayAvgSpeed += session.avgSpeed;
            const div = document.createElement('div');
            div.classList.add('session');
            div.innerHTML = `
                <p>Time: ${session.timeOfDay}</p>
                <p>Wind Speed: ${session.windSpeed} knots</p>
                <p>Wind Direction: ${session.windDirection}</p>
                <p>Tide: ${session.tide}</p>
                <p>Equipment: ${session.equipment}</p>
                <p>Distance: ${session.distance} miles</p>
                <p>Duration: ${session.duration} minutes</p>
                <p>Max Speed: ${session.maxSpeed} knots</p>
                <p>Avg Speed: ${session.avgSpeed} knots</p>
                <p>Jumps: ${session.jumps}</p>
                <p>Max Jump Height: ${session.jumpHeight} feet</p>
                <p>Gybes/Tacks: ${session.gybes}</p>
                <p>Notes: ${session.notes || 'None'}</p>
            `;
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => editSession(index));
            div.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => deleteSession(index));
            div.appendChild(deleteBtn);
            list.appendChild(div);
        });
        document.getElementById('day-total-distance').textContent = `Total Distance Today: ${dayTotal.toFixed(2)} miles`;
        if (sessionCount > 0) dayAvgSpeed = (dayAvgSpeed / sessionCount).toFixed(2);
        // Could add more day totals here if needed
    }

    // Modal and form
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementsByClassName('close')[0];
    const form = document.getElementById('session-form');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };

    document.getElementById('add-session').addEventListener('click', () => {
        editingSessionId = null;
        document.getElementById('modal-title').textContent = 'Add New Session';
        form.reset();
        // Pre-fill defaults from settings if applicable
        modal.style.display = 'block';
    });

    function editSession(index) {
        editingSessionId = index;
        const session = data[selectedDate][index];
        document.getElementById('timeOfDay').value = session.timeOfDay;
        document.getElementById('windSpeed').value = session.windSpeed;
        document.getElementById('windDirection').value = session.windDirection;
        document.getElementById('tide').value = session.tide;
        document.getElementById('equipment').value = session.equipment;
        document.getElementById('distance').value = session.distance;
        document.getElementById('duration').value = session.duration;
        document.getElementById('maxSpeed').value = session.maxSpeed;
        document.getElementById('avgSpeed').value = session.avgSpeed;
        document.getElementById('jumps').value = session.jumps;
        document.getElementById('jumpHeight').value = session.jumpHeight;
        document.getElementById('gybes').value = session.gybes;
        document.getElementById('notes').value = session.notes;
        document.getElementById('modal-title').textContent = 'Edit Session';
        modal.style.display = 'block';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const session = {
            timeOfDay: document.getElementById('timeOfDay').value,
            windSpeed: parseFloat(document.getElementById('windSpeed').value),
            windDirection: document.getElementById('windDirection').value,
            tide: document.getElementById('tide').value,
            equipment: document.getElementById('equipment').value,
            distance: parseFloat(document.getElementById('distance').value),
            duration: parseInt(document.getElementById('duration').value),
            maxSpeed: parseFloat(document.getElementById('maxSpeed').value),
            avgSpeed: parseFloat(document.getElementById('avgSpeed').value),
            jumps: parseInt(document.getElementById('jumps').value),
            jumpHeight: parseFloat(document.getElementById('jumpHeight').value),
            gybes: parseInt(document.getElementById('gybes').value),
            notes: document.getElementById('notes').value
        };
        if (!data[selectedDate]) data[selectedDate] = [];
        if (editingSessionId !== null) {
            data[selectedDate][editingSessionId] = session;
        } else {
            data[selectedDate].push(session);
        }
        modal.style.display = 'none';
        saveData();
    });

    function deleteSession(index) {
        if (confirm('Are you sure you want to delete this session?')) {
            data[selectedDate].splice(index, 1);
            if (data[selectedDate].length === 0) delete data[selectedDate];
            saveData();
        }
    }

    // Summary and Charts
    function updateSummary() {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        let totalYear = 0;
        let totalMonth = 0;
        let totalWeek = 0;
        let totalSpeedYear = 0;
        let sessionCountYear = 0;
        const monthlyDistances = Array(12).fill(0);

        Object.entries(data).forEach(([dateStr, sessions]) => {
            const date = new Date(dateStr);
            const distance = sessions.reduce((sum, s) => sum + s.distance, 0);
            const avgSpeed = sessions.reduce((sum, s) => sum + s.avgSpeed, 0) / sessions.length;
            if (!isNaN(avgSpeed)) {
                totalSpeedYear += avgSpeed * sessions.length;
                sessionCountYear += sessions.length;
            }
            if (date >= yearStart) {
                totalYear += distance;
                monthlyDistances[date.getMonth()] += distance;
            }
            if (date >= monthStart) totalMonth += distance;
            if (date >= weekStart) totalWeek += distance;
        });

        document.getElementById('total-year').textContent = totalYear.toFixed(1);
        document.getElementById('total-month').textContent = totalMonth.toFixed(1);
        document.getElementById('total-week').textContent = totalWeek.toFixed(1);
        const avgSpeedYear = sessionCountYear > 0 ? (totalSpeedYear / sessionCountYear).toFixed(1) : 0;
        document.getElementById('avg-speed-year').textContent = avgSpeedYear;

        // Goal Progress
        if (yearlyGoal > 0) {
            const progress = (totalYear / yearlyGoal) * 100;
            document.getElementById('goal-bar').value = progress;
            document.getElementById('goal-status').textContent = `${progress.toFixed(1)}% towards goal of ${yearlyGoal} miles`;
        }

        // Badges and Milestones
        checkMilestones(totalYear);

        // Render Badges
        const badgesDiv = document.getElementById('badges');
        badgesDiv.innerHTML = '';
        badges.forEach(badge => {
            const span = document.createElement('span');
            span.classList.add('badge');
            span.textContent = badge;
            badgesDiv.appendChild(span);
        });

        // Monthly Chart
        if (chart) chart.destroy();
        const ctx = document.getElementById('monthly-chart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                datasets: [{
                    label: 'Miles per Month',
                    data: monthlyDistances,
                    borderColor: '#007bff',
                    tension: 0.1
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function checkMilestones(totalYear) {
        const milestones = [
            { threshold: 100, badge: '100 Miles Achieved!' },
            { threshold: 500, badge: '500 Miles Achieved!' },
            { threshold: 1000, badge: '1000 Miles Achieved!' }
        ];
        milestones.forEach(ms => {
            if (totalYear >= ms.threshold && !badges.includes(ms.badge)) {
                badges.push(ms.badge);
                alert(`Congratulations! You've reached ${ms.badge}`);
            }
        });
    }

    document.getElementById('set-goal').addEventListener('click', () => {
        yearlyGoal = parseFloat(document.getElementById('goal-input').value);
        if (isNaN(yearlyGoal) || yearlyGoal <= 0) {
            alert('Please enter a valid goal.');
            return;
        }
        saveData();
    });

    // CSV Download
    document.getElementById('download-csv').addEventListener('click', () => {
        let csv = 'Date,Session,Time of Day,Wind Speed,Wind Direction,Tide,Equipment,Distance,Duration,Max Speed,Avg Speed,Jumps,Jump Height,Gybes,Notes\n';
        Object.entries(data).forEach(([date, sessions]) => {
            sessions.forEach((session, index) => {
                csv += `${date},${index + 1},${session.timeOfDay},${session.windSpeed},${session.windDirection},${session.tide},${session.equipment},${session.distance},${session.duration},${session.maxSpeed},${session.avgSpeed},${session.jumps},${session.jumpHeight},${session.gybes},${session.notes.replace(/\n/g, ' ')}\n`;
            });
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'water_sports_data.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    // Share Day
    document.getElementById('share-day').addEventListener('click', async () => {
        const dayView = document.getElementById('day-view');
        const canvas = await html2canvas(dayView);
        canvas.toBlob(async (blob) => {
            const filesArray = [new File([blob], 'day_summary.png', { type: 'image/png' })];
            if (navigator.canShare && navigator.canShare({ files: filesArray })) {
                await navigator.share({
                    files: filesArray,
                    title: 'Day Summary',
                    text: 'Check out my water sports session!'
                });
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'day_summary.png';
                a.click();
                URL.revokeObjectURL(url);
            }
        });
    });

    // Initial render
    renderCalendar();
    updateSummary();
    if (yearlyGoal > 0) document.getElementById('goal-input').value = yearlyGoal;
});
