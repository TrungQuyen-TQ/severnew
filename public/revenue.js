async function loadRevenue() {
  const [year, month] = document.getElementById("monthPicker").value.split("-");

  document.getElementById("totalRevenue").innerText = "0 VNĐ";
  document.getElementById("totalOrders").innerText = "0";
  document.getElementById("bestDay").innerText = "--";
  document.getElementById("growth").innerText = "--%";
  document.getElementById("revenueTable").innerHTML = "";
  document.getElementById("topProducts").innerHTML = `
    <div class="col-span-full text-center text-gray-400">Đang tải Top sản phẩm...</div>
  `;

  if (window.lineChart instanceof Chart) window.lineChart.destroy();
  if (window.barChart instanceof Chart) window.barChart.destroy();
  if (window.pieChart instanceof Chart) window.pieChart.destroy();

  const res = await fetch(`/api/revenue?month=${month}&year=${year}`);
  const data = await res.json();
  const rows = data.daily_details || [];

  if (rows.length === 0) {
    alert("Không có dữ liệu doanh thu cho tháng này!");
    renderEmptyCharts();
    document.getElementById("topProducts").innerHTML = `
      <div class="col-span-full text-center text-gray-400">Không có dữ liệu sản phẩm bán chạy.</div>
    `;
    loadCategoryRevenue();
    return;
  }

  const total = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
  document.getElementById("totalRevenue").innerText =
    total.toLocaleString("vi-VN") + " VNĐ";

  document.getElementById("totalOrders").innerText = rows.length.toString();

  const best = rows.reduce((max, r) =>
    Number(r.revenue) > Number(max.revenue) ? r : max
  );
  document.getElementById("bestDay").innerText = best.date;

  let growth = "--%";
  if (rows.length > 1 && Number(rows[0].revenue) !== 0) {
    growth =
      (
        ((Number(best.revenue) - Number(rows[0].revenue)) /
          Number(rows[0].revenue)) *
        100
      ).toFixed(1) + "%";
  }
  document.getElementById("growth").innerText = growth;

  const tbody = document.getElementById("revenueTable");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td class="border border-gray-700 py-2">${r.date}</td>
        <td class="border border-gray-700 py-2">${Number(r.revenue).toLocaleString(
          "vi-VN"
        )} VNĐ</td>
      </tr>
  `
    )
    .join("");

  renderCharts(rows);
  loadTopProducts();
  loadCategoryRevenue();
}

async function logout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Lỗi khi gọi API logout:", error);
  }

  localStorage.removeItem("currentUsername");
  localStorage.removeItem("userRole");

  window.location.href = "/login.html";
}

function renderCharts(rows) {
  const labels = rows.map((r) => r.date);
  const values = rows.map((r) => Number(r.revenue));

  const ctx1 = document.getElementById("lineChart").getContext("2d");
  window.lineChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Doanh thu (VNĐ)",
          data: values,
          borderColor: "#60a5fa",
          backgroundColor: "rgba(59,130,246,0.3)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  const ctx2 = document.getElementById("barChart").getContext("2d");
  window.barChart = new Chart(ctx2, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Doanh thu (VNĐ)",
          data: values,
          backgroundColor: "#34d399",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

function renderEmptyCharts() {
  const emptyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
      title: {
        display: true,
        text: "Không có dữ liệu",
        color: "#aaa",
      },
    },
  };

  const ctx1 = document.getElementById("lineChart").getContext("2d");
  window.lineChart = new Chart(ctx1, {
    type: "line",
    data: { labels: [], datasets: [] },
    options: emptyOptions,
  });

  const ctx2 = document.getElementById("barChart").getContext("2d");
  window.barChart = new Chart(ctx2, {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: emptyOptions,
  });

  const ctx3 = document.getElementById("pieChart").getContext("2d");
  window.pieChart = new Chart(ctx3, {
    type: "doughnut",
    data: { labels: [], datasets: [] },
    options: emptyOptions,
  });
}

async function loadCategoryRevenue() {
  const res = await fetch("/api/revenue/by-category");
  const data = await res.json();

  const ctx = document.getElementById("pieChart").getContext("2d");

  if (!data || data.length === 0) {
    window.pieChart = new Chart(ctx, {
      type: "doughnut",
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: "Không có dữ liệu danh mục",
            color: "#aaa",
          },
          legend: { display: false },
        },
      },
    });
    return;
  }

  window.pieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.category),
      datasets: [
        {
          data: data.map((d) => Number(d.total_revenue)),
          backgroundColor: [
            "#60a5fa",
            "#fbbf24",
            "#34d399",
            "#f87171",
            "#a78bfa",
            "#9ca3af",
            "#d1d5db",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" } },
    },
  });
}

async function loadTopProducts() {
  const container = document.getElementById("topProducts");
  container.innerHTML = `<div class="col-span-full text-center text-gray-400">Đang tải...</div>`;

  try {
    const res = await fetch("/api/top-products");
    const data = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center text-gray-400">
          Không có sản phẩm bán chạy trong tháng này.
        </div>`;
      return;
    }

    container.innerHTML = data
      .map(
        (item) => `
      <div class="bg-gray-700 p-4 rounded-lg shadow">
        <img src="${item.image_url || "https://via.placeholder.com/150"}" 
             class="rounded-lg w-full h-32 object-cover mb-2">
        <div class="font-semibold">${item.name}</div>
        <div class="text-sm text-gray-300">Đã bán: ${item.total_sold}</div>
      </div>`
      )
      .join("");
  } catch (error) {
    container.innerHTML = `
      <div class="col-span-full text-center text-red-400">
        Lỗi khi tải top sản phẩm
      </div>`;
  }
}

document.getElementById("loadBtn").addEventListener("click", loadRevenue);
document.getElementById("logoutBtn").addEventListener("click", logout);

window.addEventListener("load", () => {
  const today = new Date();
  const month = (today.getMonth() + 1).toString().padStart(2, "0");
  const year = today.getFullYear();
  document.getElementById("monthPicker").value = `${year}-${month}`;

  loadRevenue();
});
