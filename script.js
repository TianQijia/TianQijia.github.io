const toggleLanguageButton = document.getElementById('toggleLanguage');

toggleLanguageButton.addEventListener('click', () => {
    const isChinese = toggleLanguageButton.textContent === '中文';
    toggleLanguageButton.textContent = isChinese ? 'English' : '中文';

    document.querySelectorAll('[data-en]').forEach(el => {
        el.textContent = isChinese ? el.getAttribute('data-zh') : el.getAttribute('data-en');
    });

});



// 选择所有的导航链接
const navLinks = document.querySelectorAll('.nav ul li a');

// 定义每个部分的元素及其对应的导航链接
const sections = document.querySelectorAll('.section[id]');
const sectionMap = {};
sections.forEach(section => {
    const id = section.getAttribute('id');
    sectionMap[id] = document.querySelector(`.nav ul li a[href="#${id}"]`);
});

// 监听滚动事件
window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        if (window.scrollY >= sectionTop - 100) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});



document.addEventListener('keydown', function(event) {
    var nav = document.querySelector('.nav');
    if (event.key === 'h') {
        nav.style.display = 'none';
    } else if (event.key === 'j') {
        nav.style.display = 'block';
    }
});



document.addEventListener('keydown', function(event) {
    var nav = document.querySelector('.extra');
    if (event.key === 'a') {
        nav.style.display = 'none';
    } else if (event.key === 's') {
        nav.style.display = 'block';
    }
});

document.querySelectorAll('.nav ul li a').forEach(link => {
    link.addEventListener('click', (event) => {
        event.preventDefault(); // 阻止默认跳转行为
        const targetId = link.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        
        // 获取目标元素的顶部位置并调整
        const offsetTop = targetElement.offsetTop - 60; // 这里的 60 是你想要的偏移量，可以根据需要调整

        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth' // 平滑滚动
        });

        // 移除所有按钮的激活状态
        document.querySelectorAll('.nav ul li a, .nav ul li button').forEach(btn => {
            btn.classList.remove('active');
        });
        // 添加当前按钮的激活状态
        link.classList.add('active');
    });
});
