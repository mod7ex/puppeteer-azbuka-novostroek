const APARTMENT_END_POINT = "https://crm.metriks.ru/local/components/itiso/shahmatki.lists/ajax.php";

/*
    action: getObjectById
    id: 11489
*/

const run = () => {
  const form = document.createElement("form");
  const id_el = document.createElement("input");
  const action_el = document.createElement("input");

  form.method = "POST";
  form.action = "/local/components/itiso/shahmatki.lists/ajax.php";

  id_el.value = 11489;
  id_el.name = "id";
  form.appendChild(id_el);

  action_el.value = "getObjectById";
  action_el.name = "action";
  form.appendChild(action_el);

  document.body.appendChild(form);

  form.submit();
};
