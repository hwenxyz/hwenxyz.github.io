window.addEventListener('DOMContentLoaded', function () {
    const searchButton = document.getElementById('search-button');
    if (searchButton) {
        searchButton.addEventListener('click', onClickSearchButton);
    }
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