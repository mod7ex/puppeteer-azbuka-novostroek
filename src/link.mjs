/*
    action: getObjectById
    id: 11489
*/

const createForm = (v) => {
  const form = document.createElement("form");
  const id_el = document.createElement("input");
  const action_el = document.createElement("input");

  form.method = "POST";
  form.action = "/local/components/itiso/shahmatki.lists/ajax.php";

  id_el.value = v;
  id_el.name = "id";
  form.appendChild(id_el);

  action_el.value = "getObjectById";
  action_el.name = "action";
  form.appendChild(action_el);

  return form;
};

// JSON page
const run = () => {
  const form = createForm();

  document.body.appendChild(form);

  form.submit();
};

const exe = () => {
  var xhttp = new XMLHttpRequest();

  xhttp.open("POST", "/local/components/itiso/shahmatki.lists/ajax.php");

  xhttp.onload = function (event) {
    console.log("Success, server responded with: " + event.target.response);
  };

  xhttp.onreadystatechange = function () {
    if (this.readyState == 4 && this.status == 200) console.log(xhttp.responseText);
  };

  xhttp.send(new FormData(createForm()));
};

const exploit = (v) => {
  return new Promise((resolve) => {
    const form = document.createElement("form");
    const id_el = document.createElement("input");
    const action_el = document.createElement("input");
    form.method = "POST";
    form.action = "/local/components/itiso/shahmatki.lists/ajax.php";
    id_el.value = v;
    id_el.name = "id";
    form.appendChild(id_el);
    action_el.value = "getObjectById";
    action_el.name = "action";
    form.appendChild(action_el);

    var xhttp = new XMLHttpRequest();

    xhttp.open("POST", "/local/components/itiso/shahmatki.lists/ajax.php");

    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) resolve(xhttp.responseText);
    };

    xhttp.send(new FormData(form));
  });
};
