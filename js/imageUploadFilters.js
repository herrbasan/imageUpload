'use strict';

const defaultFilters = {
	brightness: 1, contrast: 1, saturate: 1, sepia: 0,
	grayscale: 0
};

const filterUnits = { 'hue-rotate': 'deg', blur: 'px' };

function buildFilterString(filters) {
	const parts = Object.entries(filters)
		.map(([name, value]) => {
			if (value !== defaultFilters[name]) {
				return `${name}(${value}${filterUnits[name] || ''})`;
			}
			return null;
		})
		.filter(p => p);
	return parts.length > 0 ? parts.join(' ') : 'none';
}

function initImageFilters(g, ut, setTransform) {
	ut.log('Initializing image filters');
	if (!g.filters) g.filters = { ...defaultFilters };
	// Dynamic slider creation if .imageUpload-filter-controls exists
	const controls = ut.el('.imageUpload-filter-controls');
	if (controls) {
		controls.innerHTML = '';
		Object.keys(defaultFilters).forEach(name => {
			let min = 0, max = 2, step = 0.01, value = defaultFilters[name], label = name;
			if (name === 'hue-rotate') { min = 0; max = 360; step = 1; value = 0; }
			if (name === 'blur') { min = 0; max = 10; step = 0.1; value = 0; }
			if (name === 'invert' || name === 'grayscale' || name === 'sepia') { min = 0; max = 1; step = 0.01; value = 0; }
			const wrapper = document.createElement('div');
			wrapper.className = 'filter-slider-wrap';
			const sliderLabel = document.createElement('label');
			sliderLabel.textContent = label;
			sliderLabel.setAttribute('for', `filter-slider-${name}`);
			const slider = document.createElement('input');
			slider.type = 'range';
			slider.id = `filter-slider-${name}`;
			slider.min = min;
			slider.max = max;
			slider.step = step;
			slider.value = value;
			slider.setAttribute('data-filter', name);
			const valueSpan = document.createElement('span');
			valueSpan.className = 'filter-slider-value';
			valueSpan.textContent = value;
			wrapper.appendChild(sliderLabel);
			wrapper.appendChild(slider);
			wrapper.appendChild(valueSpan);
			controls.appendChild(wrapper);

			slider.addEventListener('input', function () {
				if (!g.filters) g.filters = { ...defaultFilters };
				const n = this.getAttribute('data-filter');
				g.filters[n] = parseFloat(this.value);
				g.activeFilter = buildFilterString(g.filters);
				valueSpan.textContent = this.value;
				const activePreset = ut.el('.filter-button.active');
				if (activePreset) activePreset.classList.remove('active');
				setTransform();
			});
		});

		// Keep sliders in sync with filter state
		function updateSliders() {
			controls.querySelectorAll('input[type=range][data-filter]').forEach(slider => {
				const n = slider.getAttribute('data-filter');
				slider.value = g.filters[n];
				slider.nextSibling.textContent = g.filters[n];
			});
		}
		// Expose for preset button logic
		initImageFilters._updateSliders = updateSliders;
	}
}

function initFilterSlider(g, ut, setTransform, options) {
	const { sliderSelector, filterName } = options;
	const slider = ut.el(sliderSelector);
	if (!slider) return;

	if (!g.filters) g.filters = { ...defaultFilters };
	g.filters[filterName] = parseFloat(slider.value);

	slider.addEventListener('input', function () {
		const activePreset = ut.el('.filter-button.active');
		if (activePreset) activePreset.classList.remove('active');

		g.filters[filterName] = parseFloat(this.value);
		g.activeFilter = buildFilterString(g.filters);
		setTransform();
	});
}

export { initImageFilters };