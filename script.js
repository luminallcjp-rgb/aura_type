"use strict";

/**
 * script.js
 * index.html専用のJavaScript。
 * 生年月日の検証、悩みの選択確認、自由記述の取得、
 * 診断開始処理（オーラ判定）、sessionStorageへの保存、result.htmlへの遷移を担当する。
 */

/** sessionStorageで使用するキー名 */
const STORAGE_KEY = "moneyAuraDiagnosis";

/** 数字の合計から導き出される最終数字と、対応するオーラキーの組み合わせ */
const NUMBER_TO_AURA_KEY = {
  1: "crimson",
  2: "silver",
  3: "amber",
  4: "jade",
  5: "blue",
  6: "roseGold",
  7: "indigo",
  8: "gold",
  9: "purple"
};

/**
 * ページの読み込みが完了したら、フォームの初期化を行う。
 */
document.addEventListener("DOMContentLoaded", () => {
  initDiagnosisForm();
});

/**
 * 診断フォームの初期化処理。
 * 送信イベントを監視し、入力検証→診断計算→保存→遷移を行う。
 */
function initDiagnosisForm() {
  const form = document.getElementById("diagnosisForm");
  const birthDateInput = document.getElementById("birthDate");

  if (!form || !birthDateInput) {
    // 必要な要素が見つからない場合は何もしない（コンソールエラーを出さない）
    return;
  }

  // 未来の日付を選べないようにする
  const todayString = formatDateToInputValue(new Date());
  birthDateInput.setAttribute("max", todayString);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleFormSubmit(form);
  });
}

/**
 * フォーム送信時のメイン処理。
 * @param {HTMLFormElement} form - 診断フォーム要素
 */
function handleFormSubmit(form) {
  clearAllErrors();

  const birthDateInput = document.getElementById("birthDate");
  const birthDateValue = birthDateInput ? birthDateInput.value : "";
  const concernInput = form.querySelector('input[name="concern"]:checked');
  const desiredFutureInput = document.getElementById("desiredFuture");
  const desiredFutureValue = desiredFutureInput ? desiredFutureInput.value : "";

  let hasError = false;

  // 生年月日の検証
  const birthDateValidation = validateBirthDate(birthDateValue);
  if (!birthDateValidation.isValid) {
    showFieldError("birthDateError", birthDateValidation.message);
    hasError = true;
  }

  // 悩み選択の検証
  if (!concernInput) {
    showFieldError("concernError", "お悩みを一つ選択してください。");
    hasError = true;
  }

  if (hasError) {
    showFormError("入力内容をご確認ください。");
    return;
  }

  // 生年月日からオーラキーを算出
  const auraKey = calculateAuraKeyFromBirthDate(birthDateValue);

  // 診断データを構築
  const diagnosisData = {
    birthDate: birthDateValue,
    auraKey: auraKey,
    concern: concernInput.value,
    desiredFuture: desiredFutureValue.trim()
  };

  // sessionStorageへ保存
  const saveSucceeded = saveDiagnosisData(diagnosisData);

  if (!saveSucceeded) {
    showFormError("診断データの保存に失敗しました。お使いのブラウザの設定をご確認のうえ、もう一度お試しください。");
    return;
  }

  // result.htmlへ遷移
  window.location.href = "result.html";
}

/**
 * 生年月日の文字列を検証する。
 * @param {string} value - input[type=date]の値（YYYY-MM-DD想定）
 * @returns {{isValid: boolean, message: string}}
 */
function validateBirthDate(value) {
  if (!value) {
    return { isValid: false, message: "生年月日を入力してください。" };
  }

  // YYYY-MM-DD形式かどうかを確認
  const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = value.match(datePattern);

  if (!match) {
    return { isValid: false, message: "生年月日の形式が正しくありません。" };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // 実在する日付かどうかをDateオブジェクトで確認
  const dateObject = new Date(year, month - 1, day);
  const isRealDate =
    dateObject.getFullYear() === year &&
    dateObject.getMonth() === month - 1 &&
    dateObject.getDate() === day;

  if (!isRealDate) {
    return { isValid: false, message: "実在する日付を入力してください。" };
  }

  // 未来の日付ではないかを確認
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateObject.getTime() > today.getTime()) {
    return { isValid: false, message: "未来の日付は選択できません。" };
  }

  // 明らかに不正な年（極端に古い年）を簡易チェック
  if (year < 1900) {
    return { isValid: false, message: "生年月日をご確認ください。" };
  }

  return { isValid: true, message: "" };
}

/**
 * 生年月日の文字列から、数秘的な合計計算を行いオーラキーを算出する。
 * 例：1992-11-28 -> 1+9+9+2+1+1+2+8=33 -> 3+3=6 -> roseGold
 * @param {string} birthDateValue - YYYY-MM-DD形式の生年月日
 * @returns {string} オーラキー（例: "roseGold"）
 */
function calculateAuraKeyFromBirthDate(birthDateValue) {
  // 数字以外の文字（ハイフンなど）を除去し、各桁を取得
  const digitsOnly = birthDateValue.replace(/\D/g, "");
  const digits = digitsOnly.split("").map(Number);

  let total = digits.reduce((sum, digit) => sum + digit, 0);

  // 一桁になるまで足し続ける
  while (total > 9) {
    total = String(total)
      .split("")
      .reduce((sum, digitChar) => sum + Number(digitChar), 0);
  }

  // 0になることは通常ないが、安全のためフォールバックを用意
  const finalNumber = total === 0 ? 9 : total;

  return NUMBER_TO_AURA_KEY[finalNumber] || "gold";
}

/**
 * 診断データをsessionStorageへ保存する。
 * @param {Object} diagnosisData - 保存する診断データ
 * @returns {boolean} 保存が成功したかどうか
 */
function saveDiagnosisData(diagnosisData) {
  try {
    const jsonString = JSON.stringify(diagnosisData);
    sessionStorage.setItem(STORAGE_KEY, jsonString);
    return true;
  } catch (error) {
    // sessionStorageが使用できない環境（プライベートモード等）への対応
    return false;
  }
}

/**
 * Dateオブジェクトをinput[type=date]用の文字列（YYYY-MM-DD）に変換する。
 * @param {Date} dateObject
 * @returns {string}
 */
function formatDateToInputValue(dateObject) {
  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, "0");
  const day = String(dateObject.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * フォーム全体のエラーメッセージを表示する。
 * @param {string} message
 */
function showFormError(message) {
  const formErrorElement = document.getElementById("formError");
  if (formErrorElement) {
    formErrorElement.textContent = message;
  }
}

/**
 * 個別フィールドのエラーメッセージを表示する。
 * @param {string} elementId - エラー表示先要素のID
 * @param {string} message
 */
function showFieldError(elementId, message) {
  const errorElement = document.getElementById(elementId);
  if (errorElement) {
    errorElement.textContent = message;
  }
}

/**
 * すべてのエラーメッセージをクリアする。
 */
function clearAllErrors() {
  showFormError("");
  showFieldError("birthDateError", "");
  showFieldError("concernError", "");
}
