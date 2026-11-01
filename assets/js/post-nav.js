(function () {
  const prevButton = document.getElementById("post-nav-prev");
  const nextButton = document.getElementById("post-nav-next");
  if (!prevButton || !nextButton) {
    return;
  }

  const currentUrl = window.location.pathname.replace(/\/+$/, "");

  function setNavState(button, post) {
    if (!button) {
      return;
    }

    if (!post || typeof post.url !== "string" || !post.url.trim()) {
      button.disabled = true;
      button.classList.remove("btn-outline-primary");
      button.classList.add("btn-outline-secondary");
      button.onclick = null;
      return;
    }

    button.disabled = false;
    button.classList.remove("btn-outline-secondary");
    button.classList.add("btn-outline-primary");
    button.onclick = function () {
      window.location.href = post.url;
    };
  }

  fetch("/assets/indexdb.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("indexdb unavailable");
      }
      return response.json();
    })
    .then(function (indexdb) {
      const posts = Array.isArray(indexdb && indexdb.posts) ? indexdb.posts : [];
      const normalized = posts
        .filter(function (post) {
          return post && typeof post.url === "string" && post.url.trim();
        })
        .map(function (post) {
          return { ...post, url: post.url.trim() };
        })
        .sort(function (a, b) {
          return a.url.localeCompare(b.url, undefined, { sensitivity: "base" });
        });

      const currentIndex = normalized.findIndex(function (post) {
        return post.url === currentUrl || post.url === currentUrl + "/";
      });

      if (currentIndex < 0) {
        setNavState(prevButton, null);
        setNavState(nextButton, null);
        return;
      }

      setNavState(prevButton, normalized[currentIndex - 1] || null);
      setNavState(nextButton, normalized[currentIndex + 1] || null);
    })
    .catch(function () {
      setNavState(prevButton, null);
      setNavState(nextButton, null);
    });
})();
