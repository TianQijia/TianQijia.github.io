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
    var nav = document.getElementById('appendix');
    if (event.key === 'a') {
        nav.style.display = 'none';
    } else if (event.key === 's') {
        nav.style.display = 'block';
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'p' || event.key === 'P') {
        const headerElement = document.querySelector('.header');
        const photoElement = document.querySelector('.header .photo');
        const infoElement = document.querySelector('.header .info');
        
        // 切换背景颜色，文本颜色和对齐方式
        if (headerElement.style.backgroundColor === 'white') {
            // 恢复原来的样式
            headerElement.style.backgroundColor = '#57cce9'; // 恢复初始背景色
            headerElement.style.color = 'white'; // 恢复初始文本颜色
            headerElement.style.justifyContent = 'space-between'; // 恢复左对齐
            infoElement.style.textAlign = 'left'; // 恢复info内容左对齐
            photoElement.style.display = 'block'; // 恢复显示照片
        } else {
            // 切换到简历模式的样式
            headerElement.style.backgroundColor = 'white'; // 改为白色背景
            headerElement.style.color = 'black'; // 改为黑色文本
            headerElement.style.justifyContent = 'center'; // 居中对齐
            infoElement.style.textAlign = 'center'; // 将info内容居中
            photoElement.style.display = 'none'; // 隐藏照片
        }
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
