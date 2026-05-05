window.addEventListener('DOMContentLoaded', function () {
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', onClickSearchButton);
    }

    initPostToc();
});

function onClickSearchButton(evt){
    const form=evt.target.closest('form');
    const searchInput = form.querySelector('input[id="search-input"]');
    const query = searchInput.value.trim();
    if(query){
        const action=form.getAttribute('action');
        const searchUrl = `${window.location.origin}${action}?q=${encodeURIComponent(query)}`;
        window.location.href = searchUrl;
    }else{
        alert("请输入搜索内容");
    }
    return false;
}

function initPostToc() {
    const article = document.getElementById('post-article-content');
    const tocRoot = document.getElementById('post-toc');
    const tocList = document.getElementById('post-toc-list');

    if (!article || !tocRoot || !tocList) {
        return;
    }

    tocList.innerHTML = '';

    const headings = Array.from(article.querySelectorAll('h1, h2, h3'));
    if (headings.length === 0) {
        tocRoot.style.display = 'none';
        return;
    }

    const usedIds = new Set();

    function slugify(text) {
        const base = (text || '')
            .toLowerCase()
            .trim()
            .replace(/[\s\u3000]+/g, '-')
            .replace(/[^\w\u4e00-\u9fff\-]/g, '')
            .replace(/\-+/g, '-')
            .replace(/^\-+|\-+$/g, '');

        return base || 'section';
    }

    const tocData = headings.map(function (heading, index) {
        const level = Number(heading.tagName.slice(1));
        const text = (heading.textContent || '').trim() || ('Section ' + (index + 1));

        let id = heading.id && heading.id.trim() ? heading.id.trim() : slugify(text);
        const originalId = id;
        let suffix = 2;

        while (usedIds.has(id) || (document.getElementById(id) && document.getElementById(id) !== heading)) {
            id = originalId + '-' + suffix;
            suffix += 1;
        }

        heading.id = id;
        usedIds.add(id);

        return { level: level, text: text, id: id };
    });

    tocData.forEach(function (item) {
        const li = document.createElement('li');
        li.className = 'mb-2';

        if (item.level === 2) {
            li.classList.add('ms-3');
        } else if (item.level === 3) {
            li.classList.add('ms-4');
        }

        const link = document.createElement('a');
        link.href = '#' + item.id;
        link.className = 'text-decoration-none';
        link.textContent = item.text;

        li.appendChild(link);
        tocList.appendChild(li);
    });
}